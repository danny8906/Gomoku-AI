/**
 * Durable Objects - 遊戲房間管理
 */

import { GameState, Player, Position, WebSocketMessage, Env } from '../types';
import { GameLogic } from '../game/GameLogic';
import { AIEngine } from '../ai/AIEngine';
import { verifyJWT } from '../utils/auth';

/** 玩家離線後的寬限期限，以 userId 對應到期時間 */
type LeaveDeadlines = Record<string, number>;

export class GameRoom {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, { userId: string; player?: Player }> =
    new Map();
  private gameState: GameState | null = null;
  private roomCode: string = '';
  private lastActivityTime: number = Date.now();
  private readonly INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 分鐘無活動後清理
  private readonly PLAYER_LEAVE_TIMEOUT = 30 * 1000; // 30秒超時

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    console.log(`GameRoom 實例創建: ID=${state.id.toString()}`);
  }

  /**
   * Durable Object 閒置時會被回收，setTimeout 不會存活，
   * 因此離線判定與房間清理都改由 Alarm 觸發。
   */
  async alarm(): Promise<void> {
    await this.loadRoomState();
    const now = Date.now();

    const deadlines = await this.getLeaveDeadlines();
    const expired = Object.entries(deadlines).filter(
      ([, deadline]) => deadline <= now
    );

    if (expired.length > 0) {
      for (const [userId] of expired) {
        delete deadlines[userId];
      }
      await this.state.storage.put('leaveDeadlines', deadlines);

      for (const [userId] of expired) {
        await this.handlePlayerTimeout(userId);
      }
    }

    if (
      now - this.lastActivityTime > this.INACTIVE_TIMEOUT &&
      this.sessions.size === 0
    ) {
      console.log(`房間 ${this.roomCode} 已閒置超過上限，開始清理`);
      await this.cleanupRoom();
      return;
    }

    await this.scheduleNextAlarm(true);
  }

  private async getLeaveDeadlines(): Promise<LeaveDeadlines> {
    return ((await this.state.storage.get('leaveDeadlines')) ||
      {}) as LeaveDeadlines;
  }

  /**
   * 排定下一次喚醒時間
   *
   * force=false 時只會把鬧鐘往前調，避免持續的活動不斷延後既有的離線判定。
   */
  private async scheduleNextAlarm(force = false): Promise<void> {
    const deadlines = await this.getLeaveDeadlines();
    const candidates = [
      ...Object.values(deadlines),
      this.lastActivityTime + this.INACTIVE_TIMEOUT,
    ];

    const next = Math.min(...candidates);
    const current = await this.state.storage.getAlarm();

    if (force || current === null || current > next) {
      await this.state.storage.setAlarm(next);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 更新活動時間
    this.updateActivity();

    if (path === '/websocket') {
      return this.handleWebSocket(request);
    }

    if (path === '/create') {
      return this.handleCreateRoom(request);
    }

    if (path === '/join' || path.startsWith('/join/')) {
      return this.handleJoinRoom(request);
    }

    if (path === '/state') {
      return this.handleGetState();
    }

    if (path === '/stats') {
      return this.handleGetStats();
    }

    if (path === '/cleanup') {
      return this.handleForceCleanup();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * 處理 WebSocket 連接
   */
  private async handleWebSocket(request: Request): Promise<Response> {
    console.log('WebSocket 請求:', request.url);

    const upgradeHeader = request.headers.get('Upgrade');
    console.log('Upgrade header:', upgradeHeader);

    if (upgradeHeader !== 'websocket') {
      console.log('不是 WebSocket 升級請求');
      return new Response('Expected websocket', { status: 400 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const roomCode = url.searchParams.get('roomCode');
    const token = url.searchParams.get('token');
    console.log('解析的 roomCode:', roomCode);

    if (!userId) {
      console.log('缺少 userId 參數');
      return new Response('Missing userId', { status: 400 });
    }

    if (userId.length > 64) {
      return new Response('Invalid userId', { status: 400 });
    }

    // userId 只是自稱的身分。若對應到已註冊帳號，就必須出示該帳號的 token，
    // 否則任何人都能用別人的 userId 連線、代為落子或以其名義發言。
    if (!(await this.isConnectionAuthorized(userId, token))) {
      console.log(`拒絕未授權的連線: ${userId}`);
      return new Response('Unauthorized', { status: 401 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    if (!server) {
      return new Response('WebSocket creation failed', { status: 500 });
    }

    await this.handleSession(server, userId, roomCode || undefined);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * 判斷連線者是否有權使用這個 userId
   *
   * 匿名玩家（資料庫沒有密碼）維持免登入；已註冊帳號則必須帶有效 token。
   */
  private async isConnectionAuthorized(
    userId: string,
    token: string | null
  ): Promise<boolean> {
    if (token) {
      const verification = await verifyJWT(token, this.env);
      if (verification.valid && verification.payload?.sub === userId) {
        return true;
      }
      return false;
    }

    try {
      const row = await this.env.DB.prepare(
        `SELECT password_hash FROM users WHERE id = ?1`
      )
        .bind(userId)
        .first();

      return !row?.password_hash;
    } catch (error) {
      // 查不到就保守拒絕，避免資料庫異常變成繞過驗證的破口
      console.error('檢查連線授權失敗:', error);
      return false;
    }
  }

  /**
   * 處理 WebSocket 會話
   */
  private async handleSession(
    webSocket: WebSocket,
    userId: string,
    roomCode?: string
  ): Promise<void> {
    webSocket.accept();

    // 更新活動時間
    this.updateActivity();

    // 載入房間狀態，如果有房間代碼則嘗試從 D1 載入
    await this.loadRoomState(roomCode);

    // 加入會話
    this.sessions.set(webSocket, { userId });

    // 檢查是否有該玩家的離線寬限期，如果有則取消
    const deadlines = await this.getLeaveDeadlines();
    if (deadlines[userId]) {
      console.log(`Player ${userId} reconnected, cancelling timeout timer`);
      delete deadlines[userId];
      await this.state.storage.put('leaveDeadlines', deadlines);

      // 通知其他玩家該玩家已重新連接
      this.broadcast({
        type: 'playerReconnected',
        data: { 
          userId: userId,
          message: 'Player has reconnected to the game.'
        },
        timestamp: Date.now(),
      }, webSocket);
    }

        // 如果這是重新連線且遊戲狀態存在，嘗試將玩家重新分配到遊戲中
        if (this.gameState && this.gameState.mode === 'pvp') {
          const playerSlot = this.findPlayerSlot(userId);
          if (playerSlot) {
            console.log(`重新連線玩家 ${userId} 已分配到 ${playerSlot} 位置`);
            // 更新會話中的玩家信息
            this.sessions.set(webSocket, { userId, player: playerSlot });
            
            // 廣播玩家重新連線
            this.broadcast({
              type: 'playerReconnected',
              data: { 
                userId: userId,
                message: 'Player has reconnected to the game.'
              },
              timestamp: Date.now(),
            }, webSocket);
          } else if (this.gameState.status === 'waiting') {
            // 如果遊戲還在等待中，嘗試自動分配玩家
            console.log(`重新連線玩家 ${userId} 在等待狀態，嘗試重新分配`);
            await this.handlePlayerJoin(webSocket, {});
          } else {
            console.log(`重新連線玩家 ${userId} 無法找到對應的遊戲位置，遊戲狀態: ${this.gameState.status}`);
          }
        }

    // 發送當前遊戲狀態
    if (this.gameState) {
      this.sendToClient(webSocket, {
        type: 'gameState',
        data: this.gameState,
        timestamp: Date.now(),
      });

      // 自動嘗試將玩家加入遊戲
      await this.handlePlayerJoin(webSocket, {});
    } else {
      console.log('WebSocket 連接時沒有遊戲狀態');
    }

    // 處理訊息
    webSocket.addEventListener('message', async event => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        this.updateActivity(); // 更新活動時間
        await this.handleMessage(webSocket, message);
      } catch (error) {
        console.error('處理 WebSocket 訊息時發生錯誤:', error);
        this.sendToClient(webSocket, {
          type: 'error',
          data: { message: '訊息處理失敗' },
          timestamp: Date.now(),
        });
      }
    });

    // 處理連接關閉
    webSocket.addEventListener('close', async (event) => {
      console.log(`WebSocket 連接關閉，代碼: ${event.code}, 原因: ${event.reason}`);
      
      const session = this.sessions.get(webSocket);
      if (session) {
        console.log(`玩家 ${session.userId} 的 WebSocket 連接關閉`);
        
        this.sessions.delete(webSocket);

        // 檢查是否已經處理過這個玩家的離開（避免重複觸發）
        const pending = await this.getLeaveDeadlines();
        const stillConnected = [...this.sessions.values()].some(
          s => s.userId === session.userId
        );

        if (pending[session.userId]) {
          console.log(`玩家 ${session.userId} 的離開檢測已經在進行中，跳過重複觸發`);
        } else if (stillConnected) {
          console.log(`玩家 ${session.userId} 仍有其他連線，不啟動離開檢測`);
        } else if (
          this.gameState &&
          this.gameState.mode === 'pvp' &&
          this.gameState.status === 'playing'
        ) {
          // 主動離開（1000）與網路斷線都走同一套寬限期判定
          console.log(`觸發玩家離開檢測: ${session.userId} (code=${event.code})`);
          await this.handlePlayerDisconnect(session.userId);
        }
      } else {
        console.log('關閉的 WebSocket 沒有對應的會話');
      }
      
      this.updateActivity(); // 更新活動時間

      // 如果沒有玩家了，更新房間狀態
      if (this.sessions.size === 0) {
        console.log('房間內沒有玩家，準備清理');
        this.handleRoomEmpty();
      } else {
        console.log(`房間內還有 ${this.sessions.size} 個玩家`);
      }
    });

    // 廣播玩家加入
    this.broadcast(
      {
        type: 'join',
        data: { userId },
        timestamp: Date.now(),
      },
      webSocket
    );
  }

  /**
   * 處理 WebSocket 訊息
   */
  private async handleMessage(
    webSocket: WebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    const session = this.sessions.get(webSocket);
    if (!session) return;

    switch (message.type) {
      case 'move':
        await this.handleMove(webSocket, message.data);
        break;

      case 'join':
        await this.handlePlayerJoin(webSocket, message.data);
        break;

      case 'leave':
        await this.handlePlayerLeave(webSocket);
        break;

      case 'chat':
        this.handleChat(webSocket, message.data);
        break;

      case 'drawRequest':
        await this.handleDrawRequest(webSocket);
        break;

      case 'drawResponse':
        await this.handleDrawResponse(webSocket, message.data);
        break;
    }
  }

  /**
   * 處理玩家落子
   */
  private async handleMove(
    webSocket: WebSocket,
    moveData: { position: Position }
  ): Promise<void> {
    if (!this.gameState || this.gameState.status !== 'playing') {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '遊戲尚未開始或已結束' },
        timestamp: Date.now(),
      });
      return;
    }

    const session = this.sessions.get(webSocket);
    if (!session || !session.player) {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '您尚未加入遊戲' },
        timestamp: Date.now(),
      });
      return;
    }

    // 座標由客戶端提供，先確認是合法整數再交給遊戲邏輯
    const position = moveData?.position;
    if (
      !position ||
      !Number.isInteger(position.row) ||
      !Number.isInteger(position.col) ||
      !GameLogic.isValidPosition(position)
    ) {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '無效的位置' },
        timestamp: Date.now(),
      });
      return;
    }

    try {
      // 執行落子
      this.gameState = GameLogic.makeMove(
        this.gameState,
        moveData.position,
        session.player
      );

      // 更新活動時間
      this.updateActivity();

      // 保存狀態
      await this.saveGameState();

      // 廣播遊戲狀態更新
      this.broadcast({
        type: 'gameState',
        data: this.gameState,
        timestamp: Date.now(),
      });

      // 如果是 AI 模式且輪到 AI
      if (
        this.gameState.mode === 'ai' &&
        this.gameState.status === 'playing' &&
        this.gameState.currentPlayer !== session.player
      ) {
        await this.handleAIMove();
      }

      // 如果遊戲結束，保存到資料庫
      if (this.gameState.status === 'finished') {
        await this.finalizeGame();
        await this.updateRoomStatus('finished');
      }
    } catch (error) {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: error instanceof Error ? error.message : '落子失敗' },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 處理 AI 落子
   */
  private async handleAIMove(): Promise<void> {
    if (!this.gameState || this.gameState.status !== 'playing') return;

    try {
      const aiEngine = new AIEngine(this.env);
      const aiMove = await aiEngine.generateMove(this.gameState);

      // 執行 AI 落子
      this.gameState = GameLogic.makeMove(
        this.gameState,
        aiMove.position,
        this.gameState.currentPlayer
      );

      // 更新活動時間
      this.updateActivity();

      // 保存狀態
      await this.saveGameState();

      // 廣播 AI 落子結果
      this.broadcast({
        type: 'gameState',
        data: {
          ...this.gameState,
          aiMove: {
            position: aiMove.position,
            reasoning: aiMove.reasoning,
            confidence: aiMove.confidence,
          },
        },
        timestamp: Date.now(),
      });

      // 如果遊戲結束，保存記錄
      if (this.gameState.status === 'finished') {
        await this.finalizeGame();
        await this.updateRoomStatus('finished');
      }
    } catch (error) {
      console.error('AI 落子失敗:', error);
      this.broadcast({
        type: 'error',
        data: { message: 'AI 思考中發生錯誤' },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 處理玩家加入
   */
  private async handlePlayerJoin(
    webSocket: WebSocket,
    _joinData: { player?: Player }
  ): Promise<void> {
    const session = this.sessions.get(webSocket);
    if (!session) {
      console.log('handlePlayerJoin: 找不到會話');
      return;
    }

    console.log(
      `玩家嘗試加入: ${session.userId}, 當前遊戲狀態:`,
      !!this.gameState
    );

    // 確保用戶存在
    await this.ensureUserExists(session.userId);

    if (!this.gameState) {
      console.log('handlePlayerJoin: 遊戲狀態不存在');
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '房間尚未創建遊戲' },
        timestamp: Date.now(),
      });
      return;
    }

    // 檢查玩家是否已經在遊戲中
    if (
      this.gameState.players.black === session.userId ||
      this.gameState.players.white === session.userId
    ) {
      console.log(`玩家 ${session.userId} 已在遊戲中`);
      // 玩家已經在遊戲中，只需要更新會話
      session.player =
        this.gameState.players.black === session.userId ? 'black' : 'white';

      // 重新廣播遊戲狀態以更新前端顯示
      this.broadcast({
        type: 'gameState',
        data: this.gameState,
        timestamp: Date.now(),
      });

      return;
    }

    // 分配玩家顏色
    let assignedPlayer: Player;
    if (this.gameState.mode === 'ai') {
      assignedPlayer = 'black'; // AI 模式玩家總是黑棋
      console.log(`AI 模式: 分配黑棋給 ${session.userId}`);
    } else {
      // PVP 模式根據房間情況分配
      if (!this.gameState.players.black) {
        assignedPlayer = 'black';
        console.log(`PVP 模式: 分配黑棋給 ${session.userId}`);
      } else if (!this.gameState.players.white) {
        assignedPlayer = 'white';
        console.log(`PVP 模式: 分配白棋給 ${session.userId}`);
      } else {
        console.log(
          `房間已滿: 黑棋=${this.gameState.players.black}, 白棋=${this.gameState.players.white}`
        );
        this.sendToClient(webSocket, {
          type: 'error',
          data: { message: '房間已滿' },
          timestamp: Date.now(),
        });
        return;
      }
    }

    // 更新會話和遊戲狀態
    session.player = assignedPlayer;
    this.gameState.players[assignedPlayer] = session.userId;

    // 如果兩名玩家都已加入，開始遊戲
    if (
      this.gameState.mode === 'pvp' &&
      this.gameState.players.black &&
      this.gameState.players.white
    ) {
      this.gameState.status = 'playing';
      console.log('PVP 遊戲開始: 兩名玩家都已加入');
    } else if (this.gameState.mode === 'ai') {
      this.gameState.status = 'playing';
      console.log('AI 遊戲開始');
    } else {
      console.log(
        `等待更多玩家: 黑棋=${this.gameState.players.black}, 白棋=${this.gameState.players.white}`
      );
    }

    // 更新活動時間
    this.updateActivity();

    await this.saveGameState();

    // 同步到 D1 資料庫
    await this.syncToD1();

    // 更新房間狀態
    await this.updateRoomStatus(this.gameState.status);

    // 廣播遊戲狀態更新
    this.broadcast({
      type: 'gameState',
      data: this.gameState,
      timestamp: Date.now(),
    });
  }

  /**
   * 處理玩家離開
   */
  private async handlePlayerLeave(webSocket: WebSocket): Promise<void> {
    const session = this.sessions.get(webSocket);
    if (!session) return;

    console.log(`Player ${session.userId} is leaving the room`);

    // 廣播玩家離開
    this.broadcast(
      {
        type: 'leave',
        data: { userId: session.userId },
        timestamp: Date.now(),
      },
      webSocket
    );

    // 如果是PVP模式且遊戲進行中，觸發玩家離開檢測
    if (this.gameState && this.gameState.mode === 'pvp' && this.gameState.status === 'playing') {
      console.log(`Triggering player disconnect for PVP game: ${session.userId}`);
      await this.handlePlayerDisconnect(session.userId);
    } else if (this.gameState && this.gameState.status === 'playing') {
      // 非PVP模式或非遊戲進行中，直接暫停遊戲
      this.gameState.status = 'waiting';
      await this.saveGameState();
      await this.syncToD1();
      await this.updateRoomStatus('waiting');
    }

    // 更新活動時間
    this.updateActivity();
  }

  /**
   * 處理玩家斷線（PVP模式）
   */
  private async handlePlayerDisconnect(userId: string): Promise<void> {
    console.log(`Player ${userId} disconnected in PVP mode`);

    // 通知其他玩家該玩家已離開
    this.broadcast({
      type: 'playerDisconnected',
      data: {
        userId: userId,
        message: 'Player has left the game. Game will end in 30 seconds if they don\'t return.',
        timeout: this.PLAYER_LEAVE_TIMEOUT
      },
      timestamp: Date.now(),
    });

    // 寬限期存進 storage，由 alarm 負責到期判定
    const deadlines = await this.getLeaveDeadlines();
    deadlines[userId] = Date.now() + this.PLAYER_LEAVE_TIMEOUT;
    await this.state.storage.put('leaveDeadlines', deadlines);
    await this.scheduleNextAlarm();
  }

  /**
   * 處理玩家超時（30秒未返回）
   */
  private async handlePlayerTimeout(userId: string): Promise<void> {
    console.log(`Player ${userId} timed out, ending game`);

    if (!this.gameState || this.gameState.status !== 'playing') {
      return;
    }

    // 逾時者必須確實是這場對局的其中一方，否則不應判定勝負
    const leaverSlot = this.findPlayerSlot(userId);
    if (!leaverSlot) {
      console.log(`逾時的 ${userId} 不在對局中，忽略`);
      return;
    }

    // 若該玩家已重新連線，就不結束遊戲
    if ([...this.sessions.values()].some(s => s.userId === userId)) {
      console.log(`玩家 ${userId} 已重新連線，取消逾時判定`);
      return;
    }

    const opponentPlayer = GameLogic.getOpponent(leaverSlot);
    const winnerUserId = opponentPlayer
      ? this.gameState.players[opponentPlayer]
      : undefined;

    if (!winnerUserId || !opponentPlayer) {
      return;
    }

    this.gameState.winner = opponentPlayer;
    this.gameState.status = 'finished';
    this.gameState.updatedAt = Date.now();

    // 廣播遊戲結束
    this.broadcast({
      type: 'gameEnd',
      data: {
        gameState: this.gameState,
        reason: 'opponentTimeout',
        message: `Player ${userId} disconnected. ${winnerUserId} wins by timeout.`
      },
      timestamp: Date.now(),
    });

    // 保存遊戲狀態
    await this.saveGameState();
    await this.syncToD1();
    await this.updateRoomStatus('finished');

    // 記錄遊戲結果
    await this.finalizeGame();
  }

  /**
   * 處理聊天訊息
   */
  private handleChat(
    webSocket: WebSocket,
    chatData: { message?: unknown }
  ): void {
    const session = this.sessions.get(webSocket);
    if (!session) return;

    const message =
      typeof chatData?.message === 'string' ? chatData.message.trim() : '';

    if (!message) return;

    // 更新活動時間
    this.updateActivity();

    this.broadcast(
      {
        type: 'chat',
        data: {
          userId: session.userId,
          message: message.slice(0, 500),
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      },
      webSocket
    );
  }

  /**
   * 處理和棋請求
   */
  private async handleDrawRequest(webSocket: WebSocket): Promise<void> {
    const session = this.sessions.get(webSocket);
    if (
      !session ||
      !session.player ||
      !this.gameState ||
      this.gameState.mode !== 'pvp'
    ) {
      console.log('和棋請求被拒絕：', { 
        hasSession: !!session, 
        hasGameState: !!this.gameState, 
        mode: this.gameState?.mode 
      });
      return;
    }

    console.log(`玩家 ${session.userId} 發起和棋請求，廣播給其他玩家`);

    // 廣播和棋請求給其他玩家
    this.broadcast(
      {
        type: 'drawRequest',
        data: {
          from: session.userId,
          message: '對方提議和棋，是否接受？'
        },
        timestamp: Date.now(),
      },
      webSocket
    );

    // 添加系統消息到聊天室
    this.broadcast(
      {
        type: 'chat',
        data: {
          userId: 'system',
          message: `${session.userId} 提議和棋`,
          isSystem: true
        },
        timestamp: Date.now(),
      }
    );
  }

  /**
   * 處理和棋回應
   */
  private async handleDrawResponse(webSocket: WebSocket, data: { accept: boolean }): Promise<void> {
    const session = this.sessions.get(webSocket);
    if (
      !session ||
      !session.player ||
      !this.gameState ||
      this.gameState.mode !== 'pvp'
    ) {
      console.log('和棋回應被拒絕：', { 
        hasSession: !!session, 
        hasGameState: !!this.gameState, 
        mode: this.gameState?.mode 
      });
      return;
    }

    console.log(`玩家 ${session.userId} 回應和棋請求：`, data.accept ? '接受' : '拒絕');

    if (data.accept) {
      // 接受和棋，結束遊戲
      this.gameState.status = 'finished';
      this.gameState.result = 'draw';
      this.gameState.winner = 'draw';

      await this.saveGameState();
      await this.syncToD1();
      await this.updateRoomStatus('finished');
      await this.finalizeGame();

      // 廣播遊戲結束
      this.broadcast(
        {
          type: 'gameEnd',
          data: {
            result: 'draw',
            message: '遊戲以和棋結束'
          },
          timestamp: Date.now(),
        }
      );

      // 添加系統消息到聊天室
      this.broadcast(
        {
          type: 'chat',
          data: {
            userId: 'system',
            message: '雙方同意和棋，遊戲結束',
            isSystem: true
          },
          timestamp: Date.now(),
        }
      );
    } else {
      // 拒絕和棋
      this.broadcast(
        {
          type: 'drawRejected',
          data: {
            message: '對方拒絕了和棋請求'
          },
          timestamp: Date.now(),
        },
        webSocket
      );

      // 添加系統消息到聊天室
      this.broadcast(
        {
          type: 'chat',
          data: {
            userId: 'system',
            message: `${session.userId} 拒絕了和棋請求`,
            isSystem: true
          },
          timestamp: Date.now(),
        }
      );
    }
  }

  /**
   * 創建房間
   */
  private async handleCreateRoom(request: Request): Promise<Response> {
    const { mode, userId } = (await request.json()) as {
      mode: 'pvp' | 'ai';
      userId: string;
    };

    console.log(`創建房間: 模式=${mode}, 創建者=${userId}`);

    // 生成房間代碼
    this.roomCode = this.generateRoomCode();

    // 創建新遊戲
    this.gameState = GameLogic.createGame(
      crypto.randomUUID(),
      mode,
      this.roomCode
    );

    // 將創建者加入遊戲
    if (mode === 'pvp') {
      this.gameState.players.black = userId; // 創建者總是黑棋
      console.log(`創建者 ${userId} 已分配為黑棋`);
    } else if (mode === 'ai') {
      this.gameState.players.black = userId; // AI 模式下玩家是黑棋
      this.gameState.status = 'playing'; // AI 模式立即開始
      console.log(`AI 模式: 玩家 ${userId} 已分配為黑棋，遊戲開始`);
    }

    // 更新活動時間
    this.updateActivity();

    // 保存到本地存儲
    await this.saveGameState();

    // 同步到 D1 資料庫
    await this.syncToD1();

    // 更新房間狀態
    await this.updateRoomStatus(this.gameState.status);

    console.log(`房間 ${this.roomCode} 創建成功`);

    return new Response(
      JSON.stringify({
        roomCode: this.roomCode,
        gameId: this.gameState.id,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 加入房間
   */
  private async handleJoinRoom(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const roomCodeFromPath = pathParts[pathParts.length - 1];

    const { roomCode, userId } = (await request.json()) as {
      roomCode: string;
      userId: string;
    };

    // 使用路徑中的房間代碼，如果沒有則使用請求體中的
    const targetRoomCode =
      roomCodeFromPath && roomCodeFromPath.length === 4
        ? roomCodeFromPath
        : roomCode;

    console.log(`嘗試加入房間: ${targetRoomCode}, 用戶: ${userId}`);
    console.log(`URL 路徑: ${url.pathname}, 路徑部分:`, pathParts);

    // 確保用戶存在
    await this.ensureUserExists(userId);

    await this.loadRoomState();

    // 如果本地沒有狀態，嘗試從 D1 資料庫載入
    if (!this.gameState) {
      try {
        console.log(`從資料庫查詢房間: ${targetRoomCode}`);
        const roomData = await this.env.DB.prepare(
          `
          SELECT r.*, g.* FROM rooms r 
          JOIN games g ON r.game_id = g.id 
          WHERE r.code = ?1
        `
        )
          .bind(targetRoomCode)
          .first();

        console.log(`資料庫查詢結果:`, roomData ? '找到房間' : '未找到房間');

        if (roomData) {
          this.roomCode = roomData.code as string;
          this.gameState = {
            id: roomData.game_id as string,
            board: JSON.parse(roomData.board_state as string),
            currentPlayer: roomData.current_player as 'black' | 'white',
            status: roomData.status as 'waiting' | 'playing' | 'finished',
            mode: roomData.mode as 'pvp' | 'ai',
            moves: [],
            winner: roomData.winner as 'black' | 'white' | 'draw' | null,
            roomCode: roomData.room_code as string,
            players: {
              black: (roomData.black_player_id as string) || undefined,
              white: (roomData.white_player_id as string) || undefined,
            },
            createdAt: roomData.created_at as number,
            updatedAt: roomData.updated_at as number,
          };

          // 保存到本地存儲
          await this.saveGameState();
        }
      } catch (error) {
        console.error('從資料庫載入房間狀態失敗:', error);
      }
    }

    console.log(
      `最終檢查: gameState存在=${!!this.gameState}, roomCode匹配=${this.gameState?.roomCode === targetRoomCode}`
    );
    console.log(
      `當前roomCode: ${this.gameState?.roomCode}, 目標roomCode: ${targetRoomCode}`
    );

    if (!this.gameState || this.gameState.roomCode !== targetRoomCode) {
      console.log(
        `房間驗證失敗: gameState=${!!this.gameState}, roomCode匹配=${this.gameState?.roomCode === targetRoomCode}`
      );
      return new Response(JSON.stringify({ error: '房間不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        gameId: this.gameState.id,
        gameState: this.gameState,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 獲取房間狀態
   */
  private async handleGetState(): Promise<Response> {
    await this.loadRoomState();

    return new Response(
      JSON.stringify({
        gameState: this.gameState,
        roomCode: this.roomCode,
        playerCount: this.sessions.size,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 獲取房間統計信息
   */
  private async handleGetStats(): Promise<Response> {
    const stats = await this.getRoomStats();

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 手動觸發清理
   */
  private async handleForceCleanup(): Promise<Response> {
    await this.forceCleanup();

    return new Response(
      JSON.stringify({
        message: '房間清理已觸發',
        roomCode: this.roomCode,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 生成 4 位房間代碼
   */
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 廣播訊息給所有客戶端
   */
  private broadcast(message: WebSocketMessage, exclude?: WebSocket): void {
    for (const [webSocket] of this.sessions) {
      if (webSocket !== exclude) {
        this.sendToClient(webSocket, message);
      }
    }
  }

  /**
   * 發送訊息給特定客戶端
   */
  private sendToClient(webSocket: WebSocket, message: WebSocketMessage): void {
    try {
      webSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('發送 WebSocket 訊息失敗:', error);
    }
  }

  /**
   * 載入房間狀態
   */
  private async loadRoomState(roomCode?: string): Promise<void> {
    // 先嘗試從本地存儲載入
    const stored = await this.state.storage.get('gameState');
    if (stored) {
      this.gameState = stored as GameState;
      console.log(`從本地存儲載入遊戲狀態: ${this.gameState.id}`);
    } else {
      console.log('本地存儲中沒有遊戲狀態');
    }

    const storedRoomCode = await this.state.storage.get('roomCode');
    if (storedRoomCode) {
      this.roomCode = storedRoomCode as string;
      console.log(`從本地存儲載入房間代碼: ${this.roomCode}`);
    } else {
      console.log('本地存儲中沒有房間代碼');
    }

    // 活動時間以 storage 為準：實例是因 alarm 才被重建時，
    // 建構子裡的 Date.now() 會讓閒置判定重新計時，房間就永遠清不掉
    const storedActivity = await this.state.storage.get('lastActivity');
    if (typeof storedActivity === 'number') {
      this.lastActivityTime = storedActivity;
    }

    // 如果本地沒有狀態但提供了房間代碼，從 D1 資料庫載入
    if (!this.gameState && roomCode && this.env.DB) {
      try {
        console.log(`嘗試從 D1 資料庫載入房間: ${roomCode}`);
        const roomData = await this.env.DB.prepare(
          `
          SELECT r.*, g.* FROM rooms r 
          JOIN games g ON r.game_id = g.id 
          WHERE r.code = ?1
        `
        )
          .bind(roomCode)
          .first();

        if (roomData) {
          console.log('從 D1 資料庫找到房間，重建狀態');
          this.roomCode = roomData.code as string;
          this.gameState = {
            id: roomData.game_id as string,
            board: JSON.parse(roomData.board_state as string),
            currentPlayer: roomData.current_player as 'black' | 'white',
            status: roomData.status as 'waiting' | 'playing' | 'finished',
            mode: roomData.mode as 'pvp' | 'ai',
            moves: [],
            winner: roomData.winner as 'black' | 'white' | 'draw' | null,
            roomCode: roomData.room_code as string,
            players: {
              black: (roomData.black_player_id as string) || undefined,
              white: (roomData.white_player_id as string) || undefined,
            },
            createdAt: roomData.created_at as number,
            updatedAt: roomData.updated_at as number,
          };

          // 保存到本地存儲
          await this.saveGameState();
          console.log('狀態已從 D1 恢復並保存到本地存儲');
        } else {
          console.log('D1 資料庫中未找到房間');
        }
      } catch (error) {
        console.error('從 D1 資料庫載入失敗:', error);
      }
    }

    // 如果本地沒有狀態，嘗試從 D1 資料庫載入
    if (!this.gameState && this.env.DB && roomCode) {
      try {
        const roomData = await this.env.DB.prepare(
          `
          SELECT r.*, g.* FROM rooms r 
          JOIN games g ON r.game_id = g.id 
          WHERE r.code = ?1
        `
        )
          .bind(roomCode)
          .first();

        if (roomData) {
          this.roomCode = roomData.code as string;
          this.gameState = {
            id: roomData.game_id as string,
            board: JSON.parse(roomData.board_state as string),
            currentPlayer: roomData.current_player as 'black' | 'white',
            status: roomData.status as 'waiting' | 'playing' | 'finished',
            mode: roomData.mode as 'pvp' | 'ai',
            moves: [], // 需要重新構建
            winner: roomData.winner as 'black' | 'white' | 'draw' | null,
            roomCode: roomData.room_code as string,
            players: {
              black: (roomData.black_player_id as string) || undefined,
              white: (roomData.white_player_id as string) || undefined,
            },
            createdAt: roomData.created_at as number,
            updatedAt: roomData.updated_at as number,
          };

          // 保存到本地存儲
          await this.saveGameState();
        }
      } catch (error) {
        console.error('從資料庫載入房間狀態失敗:', error);
      }
    }
  }

  /**
   * 保存遊戲狀態
   */
  private async saveGameState(): Promise<void> {
    if (this.gameState) {
      await this.state.storage.put('gameState', this.gameState);
      console.log(
        `保存遊戲狀態: ${this.gameState.id}, 玩家: 黑棋=${this.gameState.players.black}, 白棋=${this.gameState.players.white}`
      );
    }
    if (this.roomCode) {
      await this.state.storage.put('roomCode', this.roomCode);
      console.log(`保存房間代碼: ${this.roomCode}`);
    }
  }

  /**
   * 結算對局：寫入戰績、更新評分、標記遊戲結束
   *
   * 這是唯一的結算入口。原本落子、和棋、逾時各走不同實作，
   * 兩份邏輯都會寫 game_records 並加減評分，只要有兩條路徑同時觸發就會重複計分。
   * 以 storage 的 recorded 旗標確保每場對局只結算一次。
   */
  private async finalizeGame(): Promise<void> {
    if (!this.gameState || this.gameState.status !== 'finished') return;

    const recordedFor = await this.state.storage.get('recordedGameId');
    if (recordedFor === this.gameState.id) {
      console.log(`對局 ${this.gameState.id} 已結算過，略過`);
      return;
    }

    try {
      await this.state.storage.put('recordedGameId', this.gameState.id);

      const gameDuration = Math.max(
        0,
        this.gameState.updatedAt - this.gameState.createdAt
      );
      const isDraw = this.gameState.winner === 'draw';

      const seats = (['black', 'white'] as const)
        .map(color => ({ color, id: this.gameState!.players[color] }))
        .filter((seat): seat is { color: 'black' | 'white'; id: string } =>
          Boolean(seat.id)
        );

      if (seats.length === 0) {
        console.log('沒有可結算的玩家');
        return;
      }

      // 先確保所有玩家都存在，並取得目前評分
      const ratings = new Map<string, number>();
      for (const seat of seats) {
        await this.ensureUserExists(seat.id);
        const row = await this.env.DB.prepare(
          `SELECT rating FROM users WHERE id = ?1`
        )
          .bind(seat.id)
          .first();
        ratings.set(seat.id, (row?.rating as number) ?? 1200);
      }

      for (const seat of seats) {
        const opponent = seats.find(other => other.id !== seat.id);
        const rating = ratings.get(seat.id) ?? 1200;

        const result: 'win' | 'loss' | 'draw' = isDraw
          ? 'draw'
          : this.gameState.winner === seat.color
            ? 'win'
            : 'loss';

        const ratingChange = this.calculateRatingChange(
          rating,
          opponent ? (ratings.get(opponent.id) ?? 1200) : null,
          result
        );

        await this.env.DB.prepare(
          `
          INSERT INTO game_records (
            id, game_id, user_id, opponent_id, mode, result,
            moves, duration, rating, rating_change, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        `
        )
          .bind(
            crypto.randomUUID(),
            this.gameState.id,
            seat.id,
            opponent?.id ?? null,
            this.gameState.mode,
            result,
            JSON.stringify(this.gameState.moves),
            gameDuration,
            rating,
            ratingChange,
            Date.now()
          )
          .run();

        const column =
          result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';

        await this.env.DB.prepare(
          `UPDATE users
             SET ${column} = ${column} + 1,
                 rating = MAX(0, rating + ?1),
                 updated_at = ?2
           WHERE id = ?3`
        )
          .bind(ratingChange, Date.now(), seat.id)
          .run();

        console.log(
          `已更新玩家 ${seat.id} 的戰績: ${result}, 評分變化: ${ratingChange}`
        );
      }

      await this.env.DB.prepare(
        `UPDATE games SET status = 'finished', winner = ?1, updated_at = ?2 WHERE id = ?3`
      )
        .bind(this.gameState.winner, Date.now(), this.gameState.id)
        .run();

      console.log(`對局結算完成: ${this.gameState.id}`);
    } catch (error) {
      // 結算失敗時清掉旗標，讓之後仍有機會補記錄
      await this.state.storage.delete('recordedGameId');
      console.error('結算對局失敗:', error);
    }
  }

  /**
   * 標準 ELO 評分變化；對手為 AI（無對手評分）時採固定值
   */
  private calculateRatingChange(
    playerRating: number,
    opponentRating: number | null,
    result: 'win' | 'loss' | 'draw'
  ): number {
    if (opponentRating === null) {
      return result === 'win' ? 20 : result === 'loss' ? -10 : 0;
    }

    const expected =
      1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actual = result === 'win' ? 1 : result === 'loss' ? 0 : 0.5;

    return Math.round(32 * (actual - expected));
  }

  /**
   * 更新活動時間
   *
   * 時間必須落到 storage，否則 Durable Object 被回收後閒置判定會從頭算起。
   */
  private updateActivity(): void {
    this.lastActivityTime = Date.now();
    this.state.waitUntil(this.persistActivity());
  }

  private async persistActivity(): Promise<void> {
    try {
      await this.state.storage.put('lastActivity', this.lastActivityTime);
      await this.scheduleNextAlarm();
    } catch (error) {
      console.error('更新活動時間失敗:', error);
    }
  }

  /**
   * 確保用戶存在，如果不存在則創建
   */
  private async ensureUserExists(userId: string): Promise<void> {
    const userExists = await this.env.DB.prepare(
      `
      SELECT id FROM users WHERE id = ?1
    `
    )
      .bind(userId)
      .first();

    if (!userExists) {
      console.log(`用戶 ${userId} 不存在，正在創建...`);
      await this.env.DB.prepare(
        `
        INSERT INTO users (id, username, wins, losses, draws, rating, created_at, updated_at)
        VALUES (?1, ?2, 0, 0, 0, 1200, ?3, ?4)
      `
      )
        .bind(
          userId,
          `匿名玩家_${userId.slice(-6)}`,
          Date.now(),
          Date.now()
        )
        .run();
      console.log(`已創建用戶: ${userId}`);
    }
  }

  /**
   * 處理房間空閒情況
   */
  private async handleRoomEmpty(): Promise<void> {
    console.log(`房間 ${this.roomCode} 已空閒，更新 D1 狀態`);

    if (this.gameState) {
      // 更新遊戲狀態為等待中
      this.gameState.status = 'waiting';
      await this.saveGameState();

      // 同步到 D1 資料庫
      await this.syncToD1();
    }

    // 更新房間狀態
    await this.updateRoomStatus('waiting');
  }

  /**
   * 清理房間
   */
  private async cleanupRoom(): Promise<void> {
    try {
      console.log(`開始清理房間 ${this.roomCode}`);

      // 如果遊戲未完成，保存最終狀態到 D1
      if (this.gameState && this.gameState.status !== 'finished') {
        await this.syncToD1();
        await this.updateRoomStatus('waiting');
      }

      // 清理本地存儲
      await this.state.storage.deleteAll();

      console.log(`房間 ${this.roomCode} 清理完成`);

      // 通知 Cloudflare 可以釋放這個 Durable Object
      // 注意：實際的釋放由 Cloudflare 的垃圾回收機制處理
    } catch (error) {
      console.error(`清理房間 ${this.roomCode} 失敗:`, error);
    }
  }

  /**
   * 同步遊戲狀態到 D1 資料庫
   */
  private async syncToD1(): Promise<void> {
    if (!this.gameState || !this.env.DB) return;

    try {
      console.log(`同步遊戲狀態到 D1: ${this.gameState.id}`);

      await this.env.DB.prepare(
        `
        UPDATE games 
        SET board_state = ?1, current_player = ?2, status = ?3, 
            black_player_id = ?4, white_player_id = ?5, 
            winner = ?6, updated_at = ?7
        WHERE id = ?8
      `
      )
        .bind(
          JSON.stringify(this.gameState.board),
          this.gameState.currentPlayer,
          this.gameState.status,
          this.gameState.players.black || null,
          this.gameState.players.white || null,
          this.gameState.winner || null,
          Date.now(),
          this.gameState.id
        )
        .run();

      console.log('D1 資料庫同步完成');
    } catch (error) {
      console.error('同步到 D1 資料庫失敗:', error);
    }
  }

  /**
   * 更新房間狀態
   */
  private async updateRoomStatus(
    status: 'waiting' | 'playing' | 'finished'
  ): Promise<void> {
    if (!this.roomCode || !this.env.DB) return;

    try {
      await this.env.DB.prepare(
        `
        UPDATE rooms 
        SET status = ?1 
        WHERE code = ?2
      `
      )
        .bind(status, this.roomCode)
        .run();

      console.log(`房間 ${this.roomCode} 狀態已更新為: ${status}`);
    } catch (error) {
      console.error('更新房間狀態失敗:', error);
    }
  }

  /**
   * 獲取房間統計信息
   */
  async getRoomStats(): Promise<{
    roomCode: string;
    playerCount: number;
    lastActivity: number;
    gameState: GameState | null;
    isActive: boolean;
  }> {
    return {
      roomCode: this.roomCode,
      playerCount: this.sessions.size,
      lastActivity: this.lastActivityTime,
      gameState: this.gameState,
      isActive:
        this.sessions.size > 0 ||
        Date.now() - this.lastActivityTime < this.INACTIVE_TIMEOUT,
    };
  }

  /**
   * 手動觸發清理（用於測試或管理）
   */
  async forceCleanup(): Promise<void> {
    console.log(`手動觸發房間 ${this.roomCode} 清理`);
    await this.cleanupRoom();
  }

  /**
   * 查找玩家在遊戲中的位置
   */
  private findPlayerSlot(userId: string): 'black' | 'white' | null {
    if (!this.gameState) return null;
    
    if (this.gameState.players.black === userId) {
      return 'black';
    }
    if (this.gameState.players.white === userId) {
      return 'white';
    }
    
    return null;
  }
}
