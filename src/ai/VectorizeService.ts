/**
 * Vectorize 服務 - 儲存和檢索對局資料
 */

import { Env, GameState, GameVector, Position, Player } from '../types';
import { GameLogic } from '../game/GameLogic';

export class VectorizeService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 將遊戲狀態轉換為向量並儲存
   */
  async storeGameState(gameState: GameState, advantage?: string): Promise<void> {
    try {
      // 生成棋盤狀態的文本描述
      const boardDescription = this.generateBoardDescription(gameState);
      
      // 使用 Text Embeddings 生成向量
      const embedding = await this.generateEmbedding(boardDescription);
      
      // 創建向量物件
      const vector: GameVector = {
        id: `${gameState.id}-${gameState.moves.length}`,
        values: embedding,
        metadata: {
          gameId: gameState.id,
          boardState: GameLogic.boardToString(gameState.board),
          moveCount: gameState.moves.length,
          advantage: advantage || 'unknown',
          timestamp: Date.now()
        }
      };

      // 儲存到 Vectorize
      await this.env.VECTORIZE.upsert([vector]);
      
      console.log(`已儲存遊戲狀態向量: ${vector.id}`);
    } catch (error) {
      console.error('儲存遊戲狀態到 Vectorize 失敗:', error);
    }
  }

  /**
   * 查找相似的遊戲局面
   */
  async findSimilarGameStates(
    gameState: GameState,
    limit: number = 10,
    threshold: number = 0.8
  ): Promise<GameVector[]> {
    try {
      // 生成當前棋盤的描述和向量
      const boardDescription = this.generateBoardDescription(gameState);
      const queryVector = await this.generateEmbedding(boardDescription);

      // 在 Vectorize 中搜索相似向量
      const results = await this.env.VECTORIZE.query(queryVector, {
        topK: limit,
        returnMetadata: true,
        returnValues: true
      });

      // 過濾結果，只返回相似度高於閾值的
      return results.matches
        .filter(match => match.score >= threshold)
        .map(match => ({
          id: match.id,
          values: match.values || [],
          metadata: match.metadata as GameVector['metadata']
        }));

    } catch (error) {
      console.error('查找相似遊戲局面失敗:', error);
      return [];
    }
  }

  /**
   * 獲取歷史棋譜建議
   */
  async getHistoricalMovesSuggestions(gameState: GameState): Promise<{
    suggestions: Position[];
    reasoning: string[];
  }> {
    try {
      // 查找相似局面
      const similarGames = await this.findSimilarGameStates(gameState, 5, 0.75);
      
      if (similarGames.length === 0) {
        return {
          suggestions: [],
          reasoning: ['沒有找到相似的歷史局面']
        };
      }

      // 分析相似局面中的下一步走法
      const moveFrequency = new Map<string, { count: number; positions: Position[] }>();
      const reasoning: string[] = [];

      for (const similar of similarGames) {
        // 這裡需要從資料庫獲取完整的遊戲記錄
        // 暫時使用模擬數據
        const nextMoves = this.simulateNextMovesFromHistory(similar);
        
        for (const move of nextMoves) {
          const key = `${move.row},${move.col}`;
          if (!moveFrequency.has(key)) {
            moveFrequency.set(key, { count: 0, positions: [] });
          }
          const entry = moveFrequency.get(key)!;
          entry.count++;
          entry.positions.push(move);
        }
      }

      // 排序並選擇最常見的走法
      const sortedMoves = Array.from(moveFrequency.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);

      const suggestions = sortedMoves.map(([_, data]) => data.positions[0]);
      
      reasoning.push(`基於 ${similarGames.length} 個相似局面的分析`);
      reasoning.push(`最常見的走法出現頻率: ${sortedMoves.map(([_, data]) => data.count).join(', ')}`);

      return { suggestions, reasoning };

    } catch (error) {
      console.error('獲取歷史棋譜建議失敗:', error);
      return {
        suggestions: [],
        reasoning: ['獲取歷史建議時發生錯誤']
      };
    }
  }

  /**
   * 分析棋譜模式
   */
  async analyzeGamePatterns(gameStates: GameState[]): Promise<{
    commonPatterns: string[];
    winningStrategies: string[];
    insights: string[];
  }> {
    try {
      const patterns: string[] = [];
      const strategies: string[] = [];
      const insights: string[] = [];

      // 為每個遊戲狀態生成向量
      const vectors: number[][] = [];
      for (const gameState of gameStates) {
        const description = this.generateBoardDescription(gameState);
        const embedding = await this.generateEmbedding(description);
        vectors.push(embedding);
      }

      // 使用聚類分析找出常見模式
      const clusters = this.performSimpleClustering(vectors, gameStates);
      
      for (const cluster of clusters) {
        if (cluster.games.length >= 3) {
          patterns.push(`發現 ${cluster.games.length} 個相似局面的模式`);
          
          // 分析獲勝策略
          const winners = cluster.games.filter(g => g.winner !== null && g.winner !== 'draw');
          if (winners.length > 0) {
            const blackWins = winners.filter(g => g.winner === 'black').length;
            const whiteWins = winners.filter(g => g.winner === 'white').length;
            
            if (blackWins > whiteWins) {
              strategies.push('在此類局面中，黑棋勝率較高');
            } else if (whiteWins > blackWins) {
              strategies.push('在此類局面中，白棋勝率較高');
            }
          }
        }
      }

      // 生成洞察
      insights.push(`分析了 ${gameStates.length} 個遊戲局面`);
      insights.push(`發現 ${patterns.length} 個常見模式`);
      insights.push(`識別出 ${strategies.length} 個獲勝策略`);

      return { commonPatterns: patterns, winningStrategies: strategies, insights };

    } catch (error) {
      console.error('分析棋譜模式失敗:', error);
      return {
        commonPatterns: [],
        winningStrategies: [],
        insights: ['分析過程中發生錯誤']
      };
    }
  }

  /**
   * 清理舊的向量數據
   */
  async cleanupOldVectors(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cutoffTime = Date.now() - maxAge;
      
      // 查詢所有向量（這裡需要實現分頁查詢）
      // Vectorize 目前可能不支援直接的時間範圍查詢，
      // 這個功能可能需要配合 D1 資料庫來實現
      
      console.log(`清理 ${cutoffTime} 之前的向量數據`);
      
    } catch (error) {
      console.error('清理舊向量數據失敗:', error);
    }
  }

  /**
   * 生成棋盤狀態的文本描述
   */
  private generateBoardDescription(gameState: GameState): string {
    const boardString = GameLogic.boardToString(gameState.board);
    const moveCount = gameState.moves.length;
    const currentPlayer = gameState.currentPlayer;
    
    // 分析棋盤特徵
    const features = this.analyzeBoardFeatures(gameState.board);
    
    const description = `五子棋局面分析：
棋盤狀態：
${boardString}

遊戲信息：
- 已下棋子數：${moveCount}
- 當前玩家：${currentPlayer === 'black' ? '黑棋' : '白棋'}
- 遊戲狀態：${gameState.status}

棋盤特徵：
- 黑棋數量：${features.blackCount}
- 白棋數量：${features.whiteCount}
- 最長連子：${features.longestSequence}
- 活躍區域：${features.activeRegion}
- 中心控制：${features.centerControl}

最近走法：${gameState.moves.slice(-3).map(move => 
  `${move.player}(${move.position.row},${move.position.col})`
).join(' -> ')}`;

    return description;
  }

  /**
   * 分析棋盤特徵
   */
  private analyzeBoardFeatures(board: Player[][]) {
    let blackCount = 0;
    let whiteCount = 0;
    let longestSequence = 0;
    const center = Math.floor(GameLogic.BOARD_SIZE / 2);
    let centerControl = 0;

    // 統計棋子數量和中心控制
    for (let row = 0; row < GameLogic.BOARD_SIZE; row++) {
      for (let col = 0; col < GameLogic.BOARD_SIZE; col++) {
        const cell = board[row][col];
        if (cell === 'black') {
          blackCount++;
          if (Math.abs(row - center) <= 2 && Math.abs(col - center) <= 2) {
            centerControl++;
          }
        } else if (cell === 'white') {
          whiteCount++;
          if (Math.abs(row - center) <= 2 && Math.abs(col - center) <= 2) {
            centerControl--;
          }
        }
      }
    }

    // 找出最長連子
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let row = 0; row < GameLogic.BOARD_SIZE; row++) {
      for (let col = 0; col < GameLogic.BOARD_SIZE; col++) {
        const player = board[row][col];
        if (player) {
          for (const [dx, dy] of directions) {
            let count = 1;
            let r = row + dx;
            let c = col + dy;
            while (r >= 0 && r < GameLogic.BOARD_SIZE && 
                   c >= 0 && c < GameLogic.BOARD_SIZE && 
                   board[r][c] === player) {
              count++;
              r += dx;
              c += dy;
            }
            longestSequence = Math.max(longestSequence, count);
          }
        }
      }
    }

    // 確定活躍區域
    let minRow = GameLogic.BOARD_SIZE, maxRow = -1;
    let minCol = GameLogic.BOARD_SIZE, maxCol = -1;
    for (let row = 0; row < GameLogic.BOARD_SIZE; row++) {
      for (let col = 0; col < GameLogic.BOARD_SIZE; col++) {
        if (board[row][col]) {
          minRow = Math.min(minRow, row);
          maxRow = Math.max(maxRow, row);
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }

    const activeRegion = minRow <= maxRow ? 
      `(${minRow},${minCol})-(${maxRow},${maxCol})` : 
      'none';

    return {
      blackCount,
      whiteCount,
      longestSequence,
      activeRegion,
      centerControl
    };
  }

  /**
   * 使用 Text Embeddings 生成向量
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [text]
      });
      
      return result.data[0];
    } catch (error) {
      console.error('生成文本嵌入失敗:', error);
      // 返回零向量作為降級方案
      return new Array(384).fill(0);
    }
  }

  /**
   * 簡單聚類分析
   */
  private performSimpleClustering(vectors: number[][], gameStates: GameState[]) {
    const clusters: { centroid: number[]; games: GameState[] }[] = [];
    const threshold = 0.8;

    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];
      const gameState = gameStates[i];
      
      // 找到最相似的聚類
      let bestCluster = -1;
      let bestSimilarity = -1;
      
      for (let j = 0; j < clusters.length; j++) {
        const similarity = this.cosineSimilarity(vector, clusters[j].centroid);
        if (similarity > bestSimilarity && similarity > threshold) {
          bestSimilarity = similarity;
          bestCluster = j;
        }
      }
      
      if (bestCluster >= 0) {
        // 加入現有聚類
        clusters[bestCluster].games.push(gameState);
        // 更新聚類中心
        this.updateCentroid(clusters[bestCluster].centroid, vector);
      } else {
        // 創建新聚類
        clusters.push({
          centroid: [...vector],
          games: [gameState]
        });
      }
    }

    return clusters;
  }

  /**
   * 計算餘弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 更新聚類中心
   */
  private updateCentroid(centroid: number[], newVector: number[]): void {
    for (let i = 0; i < centroid.length; i++) {
      centroid[i] = (centroid[i] + newVector[i]) / 2;
    }
  }

  /**
   * 模擬從歷史數據獲取下一步走法
   */
  private simulateNextMovesFromHistory(similar: GameVector): Position[] {
    // 這是一個模擬函數，實際應該從 D1 資料庫查詢完整遊戲記錄
    const moveCount = similar.metadata.moveCount;
    const suggestions: Position[] = [];
    
    // 基於棋盤狀態生成一些可能的走法
    for (let i = 0; i < 3; i++) {
      suggestions.push({
        row: Math.floor(Math.random() * GameLogic.BOARD_SIZE),
        col: Math.floor(Math.random() * GameLogic.BOARD_SIZE)
      });
    }
    
    return suggestions;
  }
}
