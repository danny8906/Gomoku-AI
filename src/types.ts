/**
 * 類型定義
 */

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
}

// 遊戲相關類型
export type Player = 'black' | 'white' | null;
export type GameMode = 'pvp' | 'ai';
export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  player: Player;
  position: Position;
  timestamp: number;
}

export interface GameState {
  id: string;
  board: Player[][];
  currentPlayer: Player;
  status: GameStatus;
  mode: GameMode;
  moves: Move[];
  winner: Player | 'draw';
  roomCode?: string;
  players: {
    black?: string;
    white?: string;
  };
  createdAt: number;
  updatedAt: number;
}

// AI 相關類型
export interface GameAnalysis {
  advantage: 'advantage' | 'disadvantage' | 'draw';
  confidence: number;
  reasoning: string;
}

export interface AIMove {
  position: Position;
  confidence: number;
  reasoning: string;
}

// 用戶相關類型
export interface User {
  id: string;
  username: string;
  email?: string;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  createdAt: number;
  updatedAt: number;
}

export interface GameRecord {
  id: string;
  gameId: string;
  userId: string;
  opponentId?: string;
  mode: GameMode;
  result: 'win' | 'loss' | 'draw';
  moves: Move[];
  duration: number;
  rating: number;
  ratingChange: number;
  createdAt: number;
}

// 房間相關類型
export interface Room {
  code: string;
  gameId: string;
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
}

// Vectorize 相關類型
export interface GameVector {
  id: string;
  values: number[];
  metadata: {
    gameId: string;
    boardState: string;
    moveCount: number;
    advantage: string;
    timestamp: number;
  };
}

// WebSocket 訊息類型
export interface WebSocketMessage {
  type: 'move' | 'join' | 'leave' | 'chat' | 'gameState' | 'error';
  data: any;
  timestamp: number;
}
