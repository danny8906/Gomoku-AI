/**
 * Durable Objects - 遊戲房間管理
 */

import { GameState, Player, Position, WebSocketMessage, Env } from '../types';
import { GameLogic } from '../game/GameLogic';
import { AIEngine } from '../ai/AIEngine';

export class GameRoom {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, { userId: string; player?: Player }> = new Map();
  private gameState: GameState | null = null;
  private roomCode: string = '';

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    console.log(`GameRoom 實例創建: ID=${state.id.toString()}`);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

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
    console.log('解析的 userId:', userId);
    console.log('解析的 roomCode:', roomCode);
    console.log('完整 URL:', url.toString());
    console.log('查詢參數:', url.search);
    
    if (!userId) {
      console.log('缺少 userId 參數');
      return new Response('Missing userId', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    await this.handleSession(server, userId, roomCode);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * 處理 WebSocket 會話
   */
  private async handleSession(webSocket: WebSocket, userId: string, roomCode?: string): Promise<void> {
    webSocket.accept();

    // 載入房間狀態，如果有房間代碼則嘗試從 D1 載入
    await this.loadRoomState(roomCode);

    // 加入會話
    this.sessions.set(webSocket, { userId });

    // 發送當前遊戲狀態
    if (this.gameState) {
      this.sendToClient(webSocket, {
        type: 'gameState',
        data: this.gameState,
        timestamp: Date.now()
      });
      
      // 自動嘗試將玩家加入遊戲
      await this.handlePlayerJoin(webSocket, {});
    } else {
      console.log('WebSocket 連接時沒有遊戲狀態');
    }

    // 處理訊息
    webSocket.addEventListener('message', async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        await this.handleMessage(webSocket, message);
      } catch (error) {
        console.error('處理 WebSocket 訊息時發生錯誤:', error);
        this.sendToClient(webSocket, {
          type: 'error',
          data: { message: '訊息處理失敗' },
          timestamp: Date.now()
        });
      }
    });

    // 處理連接關閉
    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
    });

    // 廣播玩家加入
    this.broadcast({
      type: 'join',
      data: { userId },
      timestamp: Date.now()
    }, webSocket);
  }

  /**
   * 處理 WebSocket 訊息
   */
  private async handleMessage(webSocket: WebSocket, message: WebSocketMessage): Promise<void> {
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
    }
  }

  /**
   * 處理玩家落子
   */
  private async handleMove(webSocket: WebSocket, moveData: { position: Position }): Promise<void> {
    if (!this.gameState || this.gameState.status !== 'playing') {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '遊戲尚未開始或已結束' },
        timestamp: Date.now()
      });
      return;
    }

    const session = this.sessions.get(webSocket);
    if (!session || !session.player) {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '您尚未加入遊戲' },
        timestamp: Date.now()
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

      // 保存狀態
      await this.saveGameState();

      // 廣播遊戲狀態更新
      this.broadcast({
        type: 'gameState',
        data: this.gameState,
        timestamp: Date.now()
      });

      // 如果是 AI 模式且輪到 AI
      if (this.gameState.mode === 'ai' && 
          this.gameState.status === 'playing' && 
          this.gameState.currentPlayer !== session.player) {
        await this.handleAIMove();
      }

      // 如果遊戲結束，保存到資料庫
      if (this.gameState.status === 'finished') {
        await this.saveGameRecord();
      }

    } catch (error) {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: error instanceof Error ? error.message : '落子失敗' },
        timestamp: Date.now()
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
            confidence: aiMove.confidence
          }
        },
        timestamp: Date.now()
      });

      // 如果遊戲結束，保存記錄
      if (this.gameState.status === 'finished') {
        await this.saveGameRecord();
      }

    } catch (error) {
      console.error('AI 落子失敗:', error);
      this.broadcast({
        type: 'error',
        data: { message: 'AI 思考中發生錯誤' },
        timestamp: Date.now()
      });
    }
  }

  /**
   * 處理玩家加入
   */
  private async handlePlayerJoin(webSocket: WebSocket, joinData: { player?: Player }): Promise<void> {
    const session = this.sessions.get(webSocket);
    if (!session) {
      console.log('handlePlayerJoin: 找不到會話');
      return;
    }

    console.log(`玩家嘗試加入: ${session.userId}, 當前遊戲狀態:`, !!this.gameState);

    if (!this.gameState) {
      console.log('handlePlayerJoin: 遊戲狀態不存在');
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '房間尚未創建遊戲' },
        timestamp: Date.now()
      });
      return;
    }

    // 檢查玩家是否已經在遊戲中
    if (this.gameState.players.black === session.userId || this.gameState.players.white === session.userId) {
      console.log(`玩家 ${session.userId} 已在遊戲中`);
      // 玩家已經在遊戲中，只需要更新會話
      session.player = this.gameState.players.black === session.userId ? 'black' : 'white';
      
      // 重新廣播遊戲狀態以更新前端顯示
      this.broadcast({
        type: 'gameState',
        data: this.gameState,
        timestamp: Date.now()
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
        console.log(`房間已滿: 黑棋=${this.gameState.players.black}, 白棋=${this.gameState.players.white}`);
        this.sendToClient(webSocket, {
          type: 'error',
          data: { message: '房間已滿' },
          timestamp: Date.now()
        });
        return;
      }
    }

    // 更新會話和遊戲狀態
    session.player = assignedPlayer;
    this.gameState.players[assignedPlayer] = session.userId;

    // 如果兩名玩家都已加入，開始遊戲
    if (this.gameState.mode === 'pvp' && 
        this.gameState.players.black && 
        this.gameState.players.white) {
      this.gameState.status = 'playing';
      console.log('PVP 遊戲開始: 兩名玩家都已加入');
    } else if (this.gameState.mode === 'ai') {
      this.gameState.status = 'playing';
      console.log('AI 遊戲開始');
    } else {
      console.log(`等待更多玩家: 黑棋=${this.gameState.players.black}, 白棋=${this.gameState.players.white}`);
    }

    await this.saveGameState();
    
    // 同時更新 D1 資料庫
    try {
      await this.env.DB.prepare(`
        UPDATE games 
        SET black_player_id = ?1, white_player_id = ?2, status = ?3, updated_at = ?4
        WHERE id = ?5
      `).bind(
        this.gameState.players.black || null,
        this.gameState.players.white || null,
        this.gameState.status,
        Date.now(),
        this.gameState.id
      ).run();
      console.log('D1 資料庫狀態已更新');
    } catch (error) {
      console.error('更新 D1 資料庫失敗:', error);
    }

    // 廣播遊戲狀態更新
    this.broadcast({
      type: 'gameState',
      data: this.gameState,
      timestamp: Date.now()
    });
  }

  /**
   * 處理玩家離開
   */
  private async handlePlayerLeave(webSocket: WebSocket): Promise<void> {
    const session = this.sessions.get(webSocket);
    if (!session) return;

    // 廣播玩家離開
    this.broadcast({
      type: 'leave',
      data: { userId: session.userId },
      timestamp: Date.now()
    }, webSocket);

    // 如果遊戲進行中，暫停遊戲
    if (this.gameState && this.gameState.status === 'playing') {
      this.gameState.status = 'waiting';
      await this.saveGameState();
    }
  }

  /**
   * 處理聊天訊息
   */
  private handleChat(webSocket: WebSocket, chatData: { message: string }): void {
    const session = this.sessions.get(webSocket);
    if (!session) return;

    this.broadcast({
      type: 'chat',
      data: {
        userId: session.userId,
        message: chatData.message,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }, webSocket);
  }

  /**
   * 創建房間
   */
  private async handleCreateRoom(request: Request): Promise<Response> {
    const { mode, userId } = await request.json() as { mode: 'pvp' | 'ai'; userId: string };
    
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

    // 保存到本地存儲
    await this.saveGameState();

    console.log(`房間 ${this.roomCode} 創建成功`);

    return new Response(JSON.stringify({
      roomCode: this.roomCode,
      gameId: this.gameState.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * 加入房間
   */
  private async handleJoinRoom(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const roomCodeFromPath = pathParts[pathParts.length - 1];
    
    const { roomCode, userId } = await request.json() as { roomCode: string; userId: string };
    
    // 使用路徑中的房間代碼，如果沒有則使用請求體中的
    const targetRoomCode = roomCodeFromPath && roomCodeFromPath.length === 4 ? roomCodeFromPath : roomCode;
    
    console.log(`嘗試加入房間: ${targetRoomCode}, 用戶: ${userId}`);
    console.log(`URL 路徑: ${url.pathname}, 路徑部分:`, pathParts);
    
    await this.loadRoomState();
    
    // 如果本地沒有狀態，嘗試從 D1 資料庫載入
    if (!this.gameState) {
      try {
        console.log(`從資料庫查詢房間: ${targetRoomCode}`);
        const roomData = await this.env.DB.prepare(`
          SELECT r.*, g.* FROM rooms r 
          JOIN games g ON r.game_id = g.id 
          WHERE r.code = ?1
        `).bind(targetRoomCode).first();
        
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
              black: roomData.black_player_id as string || undefined,
              white: roomData.white_player_id as string || undefined
            },
            createdAt: roomData.created_at as number,
            updatedAt: roomData.updated_at as number
          };
          
          // 保存到本地存儲
          await this.saveGameState();
        }
      } catch (error) {
        console.error('從資料庫載入房間狀態失敗:', error);
      }
    }
    
    console.log(`最終檢查: gameState存在=${!!this.gameState}, roomCode匹配=${this.gameState?.roomCode === targetRoomCode}`);
    console.log(`當前roomCode: ${this.gameState?.roomCode}, 目標roomCode: ${targetRoomCode}`);
    
    if (!this.gameState || this.gameState.roomCode !== targetRoomCode) {
      console.log(`房間驗證失敗: gameState=${!!this.gameState}, roomCode匹配=${this.gameState?.roomCode === targetRoomCode}`);
      return new Response(JSON.stringify({ error: '房間不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      gameId: this.gameState.id,
      gameState: this.gameState
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * 獲取房間狀態
   */
  private async handleGetState(): Promise<Response> {
    await this.loadRoomState();
    
    return new Response(JSON.stringify({
      gameState: this.gameState,
      roomCode: this.roomCode,
      playerCount: this.sessions.size
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
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
    
    // 如果本地沒有狀態但提供了房間代碼，從 D1 資料庫載入
    if (!this.gameState && roomCode && this.env.DB) {
      try {
        console.log(`嘗試從 D1 資料庫載入房間: ${roomCode}`);
        const roomData = await this.env.DB.prepare(`
          SELECT r.*, g.* FROM rooms r 
          JOIN games g ON r.game_id = g.id 
          WHERE r.code = ?1
        `).bind(roomCode).first();
        
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
              black: roomData.black_player_id as string || undefined,
              white: roomData.white_player_id as string || undefined
            },
            createdAt: roomData.created_at as number,
            updatedAt: roomData.updated_at as number
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
    if (!this.gameState && this.env.DB) {
      try {
        // WebSocket 連接時不嘗試從資料庫載入，避免 targetRoomCode 未定義錯誤
        if (false) { // 暫時禁用
          const roomData = await this.env.DB.prepare(`
            SELECT r.*, g.* FROM rooms r 
            JOIN games g ON r.game_id = g.id 
            WHERE r.code = ?1
          `).bind(targetRoomCode).first();
          
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
                black: roomData.black_player_id as string || undefined,
                white: roomData.white_player_id as string || undefined
              },
              createdAt: roomData.created_at as number,
              updatedAt: roomData.updated_at as number
            };
            
            // 保存到本地存儲
            await this.saveGameState();
          }
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
      console.log(`保存遊戲狀態: ${this.gameState.id}, 玩家: 黑棋=${this.gameState.players.black}, 白棋=${this.gameState.players.white}`);
    }
    if (this.roomCode) {
      await this.state.storage.put('roomCode', this.roomCode);
      console.log(`保存房間代碼: ${this.roomCode}`);
    }
  }

  /**
   * 保存遊戲記錄到 D1 資料庫
   */
  private async saveGameRecord(): Promise<void> {
    if (!this.gameState || this.gameState.status !== 'finished') return;

    try {
      console.log('開始保存遊戲記錄:', this.gameState.id);
      
      const gameDuration = this.gameState.updatedAt - this.gameState.createdAt;
      
      // 為每個玩家創建遊戲記錄
      const players = [
        { id: this.gameState.players.black, color: 'black' },
        { id: this.gameState.players.white, color: 'white' }
      ].filter(p => p.id); // 過濾掉空的玩家

      for (const player of players) {
        if (!player.id) continue;
        
        // 檢查用戶是否存在，如果不存在則創建
        let userExists = await this.env.DB.prepare(`
          SELECT id FROM users WHERE id = ?1
        `).bind(player.id).first();
        
        if (!userExists) {
          console.log(`用戶 ${player.id} 不存在，正在創建...`);
          // 創建新用戶
          await this.env.DB.prepare(`
            INSERT INTO users (id, username, wins, losses, draws, rating, created_at, updated_at)
            VALUES (?1, ?2, 0, 0, 0, 1200, ?3, ?4)
          `).bind(
            player.id,
            `匿名玩家_${player.id.substring(0, 5)}`, // 生成用戶名
            Date.now(),
            Date.now()
          ).run();
          console.log(`已創建用戶: ${player.id}`);
        }
        
        // 確定遊戲結果
        let result: 'win' | 'loss' | 'draw';
        if (this.gameState.winner === 'draw') {
          result = 'draw';
        } else if (this.gameState.winner === player.color) {
          result = 'win';
        } else {
          result = 'loss';
        }
        
        // 獲取玩家當前評分
        const userResult = await this.env.DB.prepare(`
          SELECT rating FROM users WHERE id = ?1
        `).bind(player.id).first();
        
        const currentRating = userResult?.rating as number || 1200;
        
        // 計算評分變化（簡化版 ELO）
        let ratingChange = 0;
        if (result === 'win') {
          ratingChange = 25;
        } else if (result === 'loss') {
          ratingChange = -15;
        } else {
          ratingChange = 0;
        }
        
        // 獲取對手 ID，確保對手也存在
        const opponentId = players.find(p => p.id !== player.id)?.id;
        if (opponentId) {
          const opponentExists = await this.env.DB.prepare(`
            SELECT id FROM users WHERE id = ?1
          `).bind(opponentId).first();
          
          if (!opponentExists) {
            console.log(`對手 ${opponentId} 不存在，正在創建...`);
            await this.env.DB.prepare(`
              INSERT INTO users (id, username, wins, losses, draws, rating, created_at, updated_at)
              VALUES (?1, ?2, 0, 0, 0, 1200, ?3, ?4)
            `).bind(
              opponentId,
              `匿名玩家_${opponentId.substring(0, 5)}`,
              Date.now(),
              Date.now()
            ).run();
            console.log(`已創建對手: ${opponentId}`);
          }
        }
        
        // 保存遊戲記錄
        await this.env.DB.prepare(`
          INSERT INTO game_records (
            id, game_id, user_id, opponent_id, mode, result, 
            moves, duration, rating, rating_change, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        `).bind(
          crypto.randomUUID(),
          this.gameState.id,
          player.id,
          opponentId || null,
          this.gameState.mode,
          result,
          JSON.stringify(this.gameState.moves),
          gameDuration,
          currentRating,
          ratingChange,
          Date.now()
        ).run();
        
        // 更新用戶戰績
        const updateQuery = result === 'win' ? 
          `UPDATE users SET wins = wins + 1, rating = rating + ?1, updated_at = ?2 WHERE id = ?3` :
          result === 'loss' ?
          `UPDATE users SET losses = losses + 1, rating = rating + ?1, updated_at = ?2 WHERE id = ?3` :
          `UPDATE users SET draws = draws + 1, updated_at = ?2 WHERE id = ?3`;
        
        if (result === 'draw') {
          await this.env.DB.prepare(updateQuery).bind(Date.now(), player.id).run();
        } else {
          await this.env.DB.prepare(updateQuery).bind(ratingChange, Date.now(), player.id).run();
        }
        
        console.log(`已更新玩家 ${player.id} 的戰績: ${result}, 評分變化: ${ratingChange}`);
      }
      
      // 更新遊戲狀態為已完成
      await this.env.DB.prepare(`
        UPDATE games SET status = 'finished', winner = ?1, updated_at = ?2 WHERE id = ?3
      `).bind(this.gameState.winner, Date.now(), this.gameState.id).run();
      
      console.log('遊戲記錄保存完成');
      
    } catch (error) {
      console.error('保存遊戲記錄失敗:', error);
    }
  }
}
