/**
 * AI 自我訓練服務
 * 讓AI能夠從對戰中學習並持續改進
 */

import { Env, Position, Player } from '../types';
import { GameLogic } from '../game/GameLogic';
import { PatternService } from '../database/PatternService';

export interface TrainingGame {
  id: string;
  moves: Array<{
    position: Position;
    player: Player;
    timestamp: number;
    boardState: Player[][];
    moveQuality: 'good' | 'bad' | 'neutral';
    gameOutcome?: 'win' | 'lose' | 'draw';
  }>;
  finalOutcome: 'win' | 'lose' | 'draw';
  difficulty: 'easy' | 'medium' | 'hard';
  trainingValue: number; // 0-1, 表示這局遊戲的學習價值
}

/**
 * 自我訓練的背景執行時間上限
 *
 * 自我對戰現在完全是 CPU 運算（不再有等待模型回應的 I/O），
 * 因此這段時間會實打實地計入 Worker 的 CPU 限制，預算必須留足餘裕。
 */
const TRAINING_TIME_BUDGET_MS = 12 * 1000;

export interface TrainingSession {
  id: string;
  games: TrainingGame[];
  totalGames: number;
  winRate: number;
  averageQuality: number;
  startTime: number;
  endTime?: number;
}

export class SelfTrainingService {
  private env: Env;
  private patternService: PatternService;

  constructor(env: Env) {
    this.env = env;
    this.patternService = new PatternService(env);
  }

  /**
   * 開始自我訓練會話
   */
  async startTrainingSession(difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<TrainingSession> {
    const sessionId = `training-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[SelfTraining] 開始訓練會話: ${sessionId}, 難度: ${difficulty}`);
    
    const session: TrainingSession = {
      id: sessionId,
      games: [],
      totalGames: 0,
      winRate: 0,
      averageQuality: 0,
      startTime: Date.now()
    };

    // 執行多局自我對戰
    await this.executeSelfPlaySession(session, difficulty);
    
    session.endTime = Date.now();
    
    // 分析訓練結果
    await this.analyzeTrainingSession(session);
    
    return session;
  }

  /**
   * 執行自我對戰會話
   */
  private async executeSelfPlaySession(
    session: TrainingSession,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<void> {
    const maxGames = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 50;
    // Worker 的背景執行時間有限，超出預算就收工，讓已完成的部分能正常存檔
    const deadline = session.startTime + TRAINING_TIME_BUDGET_MS;
    let wins = 0;
    let totalQuality = 0;

    for (let gameIndex = 0; gameIndex < maxGames; gameIndex++) {
      if (Date.now() > deadline) {
        console.log(
          `[SelfTraining] 已達時間預算，於第 ${gameIndex + 1} 局前提早結束`
        );
        break;
      }

      try {
        console.log(`[SelfTraining] 進行第 ${gameIndex + 1}/${maxGames} 局自我對戰`);

        const game = await this.playSelfGame(gameIndex, difficulty);
        session.games.push(game);
        session.totalGames++;

        if (game.finalOutcome === 'win') wins++;
        totalQuality += game.trainingValue;

        // 每5局存儲一次學習數據
        if ((gameIndex + 1) % 5 === 0) {
          await this.storeLearningData(session.games.slice(-5));
        }
      } catch (error) {
        console.error(`[SelfTraining] 第 ${gameIndex + 1} 局對戰失敗:`, error);
      }
    }

    // 一局都沒完成時避免除以 0 產生 NaN
    session.winRate = session.totalGames > 0 ? wins / session.totalGames : 0;
    session.averageQuality =
      session.totalGames > 0 ? totalQuality / session.totalGames : 0;
  }

  /**
   * 執行單局自我對戰
   */
  private async playSelfGame(gameIndex: number, difficulty: 'easy' | 'medium' | 'hard'): Promise<TrainingGame> {
    const gameId = `self-game-${Date.now()}-${gameIndex}`;
    const game: TrainingGame = {
      id: gameId,
      moves: [],
      finalOutcome: 'draw',
      difficulty,
      trainingValue: 0
    };

    // 初始化棋盤
    const board = Array(15).fill(null).map(() => Array(15).fill(null));
    let currentPlayer: Player = 'black';
    let moveCount = 0;
    const maxMoves = 100; // 防止無限循環

    // 難度只調整探索用的擾動幅度，不改變策略本身：
    // 自我對戰必須與正式對局走同一套 GameLogic.evaluateMove，
    // 否則訓練出來的棋譜對應的是另一個對手，學到的東西用不上。
    const noise =
      difficulty === 'easy' ? 400 : difficulty === 'medium' ? 150 : 60;

    while (moveCount < maxMoves) {
      const bestMove = GameLogic.selectBestMove(board, currentPlayer, noise);

      if (!bestMove) break;

      // 記錄移動
      const move = {
        position: bestMove,
        player: currentPlayer,
        timestamp: Date.now(),
        boardState: board.map(row => [...row]),
        moveQuality: 'neutral' as 'good' | 'bad' | 'neutral'
      };

      // 落子
      board[bestMove.row]![bestMove.col] = currentPlayer;
      moveCount++;

      // 先記錄再判斷勝負：原本在致勝時直接 break，
      // 導致整局最關鍵的那一手從未進入棋譜，也就永遠學不到
      game.moves.push(move);

      if (GameLogic.checkWinner(board, bestMove, currentPlayer)) {
        game.finalOutcome = currentPlayer === 'black' ? 'win' : 'lose';
        move.moveQuality = 'good' as const;
        break;
      }

      // 走滿上限仍未分勝負即視為和局
      if (moveCount >= maxMoves) {
        game.finalOutcome = 'draw';
        break;
      }

      currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    }

    // 評估整局遊戲的學習價值
    game.trainingValue = this.evaluateGameLearningValue(game);

    // 為所有移動評估質量
    this.evaluateMoveQuality(game);

    console.log(`[SelfTraining] 遊戲 ${gameIndex + 1} 完成: ${game.finalOutcome}, 學習價值: ${game.trainingValue.toFixed(3)}`);
    
    return game;
  }

  /**
   * 評估遊戲學習價值
   */
  private evaluateGameLearningValue(game: TrainingGame): number {
    let value = 0.5; // 基礎價值

    // 根據遊戲長度調整
    const gameLength = game.moves.length;
    if (gameLength < 10) value *= 0.3; // 太短的遊戲價值較低
    else if (gameLength > 50) value *= 0.8; // 太長的遊戲價值稍低

    // 根據結果調整
    if (game.finalOutcome === 'win') value *= 1.2; // 勝利更有價值
    else if (game.finalOutcome === 'lose') value *= 0.8; // 失敗價值較低

    // 根據移動多樣性調整
    const uniquePositions = new Set(game.moves.map(m => `${m.position.row},${m.position.col}`)).size;
    const diversity = uniquePositions / game.moves.length;
    value *= (0.5 + diversity * 0.5); // 多樣性越高價值越高

    return Math.min(1, Math.max(0, value));
  }

  /**
   * 評估移動質量
   */
  private evaluateMoveQuality(game: TrainingGame): void {
    // 簡化的移動質量評估
    for (let i = 0; i < game.moves.length; i++) {
      const move = game.moves[i];
      if (!move) continue;

      // 致勝的一手已經標記為 good，不要被通用規則覆寫掉
      if (move.moveQuality === 'good') continue;

      // 根據遊戲結果和移動時機評估
      if (game.finalOutcome === 'win') {
        // 勝利遊戲中，後期的關鍵移動更有價值
        const moveImportance = (i / game.moves.length) * 0.5 + 0.5;
        move.moveQuality = moveImportance > 0.7 ? 'good' : 'neutral';
      } else if (game.finalOutcome === 'lose') {
        // 失敗遊戲中，後期的移動可能質量較差
        const moveImportance = (i / game.moves.length) * 0.5 + 0.5;
        move.moveQuality = moveImportance > 0.8 ? 'bad' : 'neutral';
      } else {
        move.moveQuality = 'neutral';
      }
    }
  }

  /**
   * 把自我對戰的成果寫進棋型書
   *
   * 原本寫入 Vectorize，但那條檢索路徑無法分辨盤面，寫進去的東西
   * 實際上永遠取不回來。改寫入 move_patterns 後才真的會被 AI 查到。
   */
  private async storeLearningData(games: TrainingGame[]): Promise<number> {
    let recorded = 0;

    for (const game of games) {
      // 太短或和局的棋譜沒有參考價值
      if (game.trainingValue < 0.3 || game.finalOutcome === 'draw') continue;

      // 轉成 PatternService 認得的形狀；勝方即實際連成五子的一方
      const winner: Player = game.finalOutcome === 'win' ? 'black' : 'white';

      try {
        recorded += await this.patternService.recordGame({
          id: game.id,
          board: [],
          currentPlayer: winner,
          status: 'finished',
          mode: 'ai',
          moves: game.moves.map(m => ({
            player: m.player,
            position: m.position,
            timestamp: m.timestamp,
          })),
          winner,
          players: {},
          createdAt: 0,
          updatedAt: 0,
        });
      } catch (error) {
        console.error(`[SelfTraining] 寫入棋型失敗 (${game.id}):`, error);
      }
    }

    console.log(`[SelfTraining] 已寫入 ${recorded} 筆棋型`);
    return recorded;
  }

  /**
   * 分析訓練會話結果
   */
  private async analyzeTrainingSession(session: TrainingSession): Promise<void> {
    const duration = session.endTime! - session.startTime;
    const averageGameTime = duration / session.totalGames;

    console.log(`[SelfTraining] 訓練會話 ${session.id} 完成:`);
    console.log(`- 總局數: ${session.totalGames}`);
    console.log(`- 勝率: ${(session.winRate * 100).toFixed(1)}%`);
    console.log(`- 平均學習價值: ${session.averageQuality.toFixed(3)}`);
    console.log(`- 總耗時: ${(duration / 1000).toFixed(1)}秒`);
    console.log(`- 平均每局: ${(averageGameTime / 1000).toFixed(1)}秒`);

    // 存儲訓練統計到KV
    await this.storeTrainingStats(session);
  }

  /**
   * 存儲訓練統計
   */
  private async storeTrainingStats(session: TrainingSession): Promise<void> {
    try {
      const statsKey = `training-stats-${session.id}`;
      const stats = {
        id: session.id,
        totalGames: session.totalGames,
        winRate: session.winRate,
        averageQuality: session.averageQuality,
        duration: session.endTime! - session.startTime,
        difficulty: session.games[0]?.difficulty || 'medium',
        timestamp: Date.now()
      };

      await this.env.gomoku_admin.put(statsKey, JSON.stringify(stats));
      console.log(`[SelfTraining] 訓練統計已存儲: ${statsKey}`);
    } catch (error) {
      console.error('[SelfTraining] 存儲訓練統計失敗:', error);
    }
  }

  /**
   * 獲取訓練統計
   */
  async getTrainingStats(sessionId?: string): Promise<any[]> {
    try {
      const keys = await this.env.gomoku_admin.list({ prefix: 'training-stats-' });
      const stats = [];

      for (const key of keys.keys) {
        if (sessionId && !key.name.includes(sessionId)) continue;
        
        const data = await this.env.gomoku_admin.get(key.name);
        if (data) {
          stats.push(JSON.parse(data));
        }
      }

      return stats.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[SelfTraining] 獲取訓練統計失敗:', error);
      return [];
    }
  }
}
