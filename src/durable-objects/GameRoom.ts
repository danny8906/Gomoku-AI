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

    if (path === '/join') {
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
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    await this.handleSession(server, userId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * 處理 WebSocket 會話
   */
  private async handleSession(webSocket: WebSocket, userId: string): Promise<void> {
    webSocket.accept();

    // 載入房間狀態
    await this.loadRoomState();

    // 加入會話
    this.sessions.set(webSocket, { userId });

    // 發送當前遊戲狀態
    if (this.gameState) {
      this.sendToClient(webSocket, {
        type: 'gameState',
        data: this.gameState,
        timestamp: Date.now()
      });
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
    if (!session) return;

    if (!this.gameState) {
      this.sendToClient(webSocket, {
        type: 'error',
        data: { message: '房間尚未創建遊戲' },
        timestamp: Date.now()
      });
      return;
    }

    // 分配玩家顏色
    let assignedPlayer: Player;
    if (this.gameState.mode === 'ai') {
      assignedPlayer = 'black'; // AI 模式玩家總是黑棋
    } else {
      // PVP 模式根據房間情況分配
      if (!this.gameState.players.black) {
        assignedPlayer = 'black';
      } else if (!this.gameState.players.white) {
        assignedPlayer = 'white';
      } else {
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
    } else if (this.gameState.mode === 'ai') {
      this.gameState.status = 'playing';
    }

    await this.saveGameState();

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
    
    // 生成房間代碼
    this.roomCode = this.generateRoomCode();
    
    // 創建新遊戲
    this.gameState = GameLogic.createGame(
      crypto.randomUUID(),
      mode,
      this.roomCode
    );

    await this.saveGameState();

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
    const { roomCode } = await request.json() as { roomCode: string };
    
    await this.loadRoomState();
    
    if (!this.gameState || this.gameState.roomCode !== roomCode) {
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
  private async loadRoomState(): Promise<void> {
    const stored = await this.state.storage.get('gameState');
    if (stored) {
      this.gameState = stored as GameState;
    }
    
    const storedRoomCode = await this.state.storage.get('roomCode');
    if (storedRoomCode) {
      this.roomCode = storedRoomCode as string;
    }
  }

  /**
   * 保存遊戲狀態
   */
  private async saveGameState(): Promise<void> {
    if (this.gameState) {
      await this.state.storage.put('gameState', this.gameState);
    }
    if (this.roomCode) {
      await this.state.storage.put('roomCode', this.roomCode);
    }
  }

  /**
   * 保存遊戲記錄到 D1 資料庫
   */
  private async saveGameRecord(): Promise<void> {
    if (!this.gameState || this.gameState.status !== 'finished') return;

    try {
      // 保存到 D1 資料庫的邏輯將在後續實現
      console.log('遊戲結束，保存記錄:', this.gameState.id);
    } catch (error) {
      console.error('保存遊戲記錄失敗:', error);
    }
  }
}
