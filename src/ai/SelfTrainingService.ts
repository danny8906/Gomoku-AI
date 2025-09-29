/**
 * AI 自我訓練服務
 * 讓AI能夠從對戰中學習並持續改進
 */

import { Env, Position, Player } from '../types';
import { GameLogic } from '../game/GameLogic';
import { VectorizeService } from './VectorizeService';

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
  private vectorizeService: VectorizeService;

  constructor(env: Env) {
    this.env = env;
    this.vectorizeService = new VectorizeService(env);
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
    let wins = 0;
    let totalQuality = 0;

    for (let gameIndex = 0; gameIndex < maxGames; gameIndex++) {
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

        // 避免過度負載
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[SelfTraining] 第 ${gameIndex + 1} 局對戰失敗:`, error);
      }
    }

    session.winRate = wins / session.totalGames;
    session.averageQuality = totalQuality / session.totalGames;
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

    while (moveCount < maxMoves) {
      // 模擬AI選擇最佳落子
      const bestMove = await this.simulateAIMove(board, currentPlayer, difficulty);
      
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

      // 檢查勝負
      if (GameLogic.checkWinner(board, bestMove, currentPlayer)) {
        game.finalOutcome = currentPlayer === 'black' ? 'win' : 'lose';
        move.moveQuality = 'good' as const;
        break;
      }

      // 檢查平局
      if (moveCount >= 225) { // 15x15棋盤
        game.finalOutcome = 'draw';
        break;
      }

      game.moves.push(move);
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
   * 模擬AI選擇最佳落子
   */
  private async simulateAIMove(
    board: Player[][], 
    player: Player, 
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<Position | null> {
    // 獲取可用位置
    const availableMoves = GameLogic.getRelevantMoves(board);
    
    if (availableMoves.length === 0) return null;

    // 簡單的AI策略模擬
    const moveScores = availableMoves.map(position => {
      let score = 0;
      
      // 進攻分數
      score += this.evaluateAttackPotential(board, position, player);
      
      // 防守分數
      score += this.evaluateDefensePotential(board, position, player);
      
      // 位置分數
      score += this.evaluatePositionValue(position);
      
      // 根據難度添加隨機性
      const randomFactor = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.1 : 0.05;
      score += (Math.random() - 0.5) * randomFactor * 100;
      
      return { position, score };
    });

    // 選擇分數最高的位置
    moveScores.sort((a, b) => b.score - a.score);
    return moveScores[0]?.position || null;
  }

  /**
   * 評估進攻潛力
   */
  private evaluateAttackPotential(board: Player[][], position: Position, player: Player): number {
    let score = 0;
    
    // 檢查四個方向
    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1]
    ];

    for (const direction of directions) {
      const [dr = 0, dc = 0] = direction;
      let consecutive = 1; // 包括自己
      let openEnds = 0;

      // 向前檢查
      for (let i = 1; i < 5; i++) {
        const newRow = position.row + dr * i;
        const newCol = position.col + dc * i;
        
        if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
          if (board[newRow]?.[newCol] === player) {
            consecutive++;
          } else if (board[newRow]?.[newCol] === null) {
            openEnds++;
            break;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // 向後檢查
      for (let i = 1; i < 5; i++) {
        const newRow = position.row - dr * i;
        const newCol = position.col - dc * i;
        
        if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
          if (board[newRow]?.[newCol] === player) {
            consecutive++;
          } else if (board[newRow]?.[newCol] === null) {
            openEnds++;
            break;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // 根據連線數量和開放端點計算分數
      if (consecutive >= 5) score += 1000; // 勝利
      else if (consecutive === 4 && openEnds >= 1) score += 500; // 四連
      else if (consecutive === 3 && openEnds >= 2) score += 100; // 三連
      else if (consecutive === 2 && openEnds >= 2) score += 10; // 二連
    }

    return score;
  }

  /**
   * 評估防守潛力
   */
  private evaluateDefensePotential(board: Player[][], position: Position, player: Player): number {
    const opponent: Player = player === 'black' ? 'white' : 'black';
    return this.evaluateAttackPotential(board, position, opponent) * 0.8; // 防守權重稍低
  }

  /**
   * 評估位置價值
   */
  private evaluatePositionValue(position: Position): number {
    const centerRow = 7;
    const centerCol = 7;
    const distanceFromCenter = Math.abs(position.row - centerRow) + Math.abs(position.col - centerCol);
    return Math.max(0, 10 - distanceFromCenter); // 中心位置價值更高
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
   * 存儲學習數據到向量資料庫
   */
  private async storeLearningData(games: TrainingGame[]): Promise<void> {
    try {
      for (const game of games) {
        if (game.trainingValue < 0.3) continue; // 只存儲有價值的遊戲

        for (const move of game.moves) {
          if (move.moveQuality === 'good') {
            // 將高質量移動存儲為學習樣本
            const gameState = {
              id: game.id,
              board: move.boardState,
              moves: game.moves.slice(0, game.moves.indexOf(move) + 1),
              currentPlayer: move.player,
              mode: 'ai' as const,
              winner: null,
              players: { black: 'AI', white: 'AI' },
              status: 'playing' as const,
              createdAt: move.timestamp,
              updatedAt: move.timestamp
            };

            await this.vectorizeService.storeGameState(
              gameState,
              game.finalOutcome === 'win' ? 'advantage' : 'balanced'
            );
          }
        }
      }

      console.log(`[SelfTraining] 存儲了 ${games.length} 個遊戲的學習數據`);
    } catch (error) {
      console.error('[SelfTraining] 存儲學習數據失敗:', error);
    }
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
