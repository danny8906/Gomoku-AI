/**
 * AI 引擎 - 使用 Cloudflare Workers AI
 */

import {
  Env,
  Player,
  Position,
  GameState,
  AIMove,
  GameAnalysis,
} from '../types';
import { GameLogic } from '../game/GameLogic';
import { VectorizeService } from './VectorizeService';

export class AIEngine {
  private env: Env;
  private vectorizeService: VectorizeService;

  constructor(env: Env) {
    this.env = env;
    this.vectorizeService = new VectorizeService(env);
  }

  /**
   * 生成 AI 落子
   */
  async generateMove(
    gameState: GameState,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): Promise<AIMove> {
    const aiPlayer = gameState.currentPlayer;
    if (!aiPlayer) {
      throw new Error('無效的玩家');
    }

    // 獲取可能的落子位置
    const availableMoves = GameLogic.getRelevantMoves(gameState.board);

    if (availableMoves.length === 0) {
      throw new Error('沒有可用的落子位置');
    }

    // 檢查是否是第一步（棋盤上沒有任何棋子）
    const isEmpty = gameState.board.every(row =>
      row.every(cell => cell === null)
    );

    if (isEmpty) {
      const center = Math.floor(GameLogic.BOARD_SIZE / 2);
      return {
        position: { row: center, col: center },
        confidence: 0.9,
        reasoning: '開局選擇中心位置，佔據有利地形',
      };
    }

    try {
      let boardAnalysis: string;
      let historicalSuggestions: { suggestions: Position[]; reasoning: string[] };
      
      // 簡單模式使用快速分析，但允許5秒超時
      if (difficulty === 'easy') {
        const analysisPromise = this.analyzeBoardState(gameState, aiPlayer);
        const historyPromise = this.getHistoricalSuggestions(gameState, aiPlayer);
        
        // 簡單模式設置5秒超時
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('AI 分析超時')), 5000);
        });

        [boardAnalysis, historicalSuggestions] = await Promise.race([
          Promise.all([analysisPromise, historyPromise]),
          timeoutPromise
        ]).catch(() => {
          // 超時時使用快速分析
          console.warn('簡單模式AI分析超時，使用快速模式');
          return [this.getQuickAnalysis(gameState, aiPlayer), { suggestions: [], reasoning: ['快速模式'] }];
        });
      } else {
        // 中等和困難模式使用完整分析，但設置超時
        const analysisPromise = this.analyzeBoardState(gameState, aiPlayer);
        const historyPromise = this.getHistoricalSuggestions(gameState, aiPlayer);
        
        // 根據難度設置超時時間
        const timeoutMs = difficulty === 'medium' ? 10000 : 20000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('AI 分析超時')), timeoutMs);
        });

        [boardAnalysis, historicalSuggestions] = await Promise.race([
          Promise.all([analysisPromise, historyPromise]),
          timeoutPromise
        ]).catch(() => {
          // 超時時使用快速分析
          console.warn('AI 分析超時，使用快速模式');
          return [this.getQuickAnalysis(gameState, aiPlayer), { suggestions: [], reasoning: [] }];
        });
      }

      // 根據分析結果、歷史建議和難度選擇最佳落子
      const bestMove = await this.selectBestMove(
        gameState,
        availableMoves,
        aiPlayer,
        boardAnalysis,
        difficulty,
        historicalSuggestions
      );

      return bestMove;
    } catch (error) {
      console.error('AI 生成落子時發生錯誤:', error);

      // 降級到基本策略
      return this.fallbackMove(gameState, availableMoves, aiPlayer);
    }
  }

  /**
   * 快速分析棋盤狀態（無需AI）
   */
  private getQuickAnalysis(gameState: GameState, player: Player): string {
    let totalMoves = 0;
    
    for (let row = 0; row < GameLogic.BOARD_SIZE; row++) {
      for (let col = 0; col < GameLogic.BOARD_SIZE; col++) {
        if (gameState.board[row]?.[col] !== null) {
          totalMoves++;
        }
      }
    }

    const moveHistory = totalMoves > 0 ? `已進行 ${totalMoves} 步` : '遊戲開始';
    
    // 快速分析：檢查是否有威脅或機會
    const hasThreats = this.hasImmediateThreats(gameState.board, player);
    const hasOpportunities = this.hasImmediateOpportunities(gameState.board, player);
    
    let analysis = `當前輪到: ${player === 'black' ? '黑棋' : '白棋'}, ${moveHistory}`;
    
    if (hasThreats) {
      analysis += '。檢測到對手威脅，需要防守';
    }
    if (hasOpportunities) {
      analysis += '。發現進攻機會';
    }
    
    return analysis;
  }

  /**
   * 檢查是否有立即威脅
   */
  private hasImmediateThreats(board: Player[][], player: Player): boolean {
    const opponent = GameLogic.getOpponent(player);
    
    // 檢查對手是否有4子連線
    for (let row = 0; row < GameLogic.BOARD_SIZE; row++) {
      for (let col = 0; col < GameLogic.BOARD_SIZE; col++) {
        if (board[row]?.[col] === opponent) {
          if (this.checkConsecutiveCount(board, row, col, opponent) >= 4) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 檢查是否有立即機會
   */
  private hasImmediateOpportunities(board: Player[][], player: Player): boolean {
    // 檢查自己是否有4子連線
    for (let row = 0; row < GameLogic.BOARD_SIZE; row++) {
      for (let col = 0; col < GameLogic.BOARD_SIZE; col++) {
        if (board[row]?.[col] === player) {
          if (this.checkConsecutiveCount(board, row, col, player) >= 4) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 檢查指定位置的最大連子數
   */
  private checkConsecutiveCount(board: Player[][], row: number, col: number, player: Player): number {
    const directions: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let maxCount = 0;

    for (const [dx, dy] of directions) {
      let count = 1;
      
      // 向一個方向檢查
      let r = row + dx;
      let c = col + dy;
      while (r >= 0 && r < GameLogic.BOARD_SIZE && c >= 0 && c < GameLogic.BOARD_SIZE && board[r]?.[c] === player) {
        count++;
        r += dx;
        c += dy;
      }
      
      // 向相反方向檢查
      r = row - dx;
      c = col - dy;
      while (r >= 0 && r < GameLogic.BOARD_SIZE && c >= 0 && c < GameLogic.BOARD_SIZE && board[r]?.[c] === player) {
        count++;
        r -= dx;
        c -= dy;
      }
      
      maxCount = Math.max(maxCount, count);
    }

    return maxCount;
  }

  /**
   * 獲取歷史棋譜建議
   */
  private async getHistoricalSuggestions(
    gameState: GameState,
    _player: Player
  ): Promise<{
    suggestions: Position[];
    reasoning: string[];
  }> {
    try {
      // 設置5秒超時，如果超時則返回空建議
      const timeoutPromise = new Promise<{ suggestions: Position[]; reasoning: string[] }>((_, reject) => {
        setTimeout(() => reject(new Error('歷史建議超時')), 5000);
      });

      return await Promise.race([
        this.vectorizeService.getHistoricalMovesSuggestions(gameState),
        timeoutPromise
      ]);
    } catch (error) {
      console.warn('獲取歷史建議失敗，使用快速模式:', error);
      return {
        suggestions: [],
        reasoning: ['快速模式：無歷史建議'],
      };
    }
  }

  /**
   * 使用 Workers AI 分析棋盤狀態
   */
  private async analyzeBoardState(
    gameState: GameState,
    player: Player
  ): Promise<string> {
    const boardString = GameLogic.boardToString(gameState.board);
    // 計算棋盤上的棋子數量來估算步數
    let totalMoves = 0;
    for (let row = 0; row < GameLogic.BOARD_SIZE; row++) {
      for (let col = 0; col < GameLogic.BOARD_SIZE; col++) {
        if (gameState.board[row]?.[col] !== null) {
          totalMoves++;
        }
      }
    }

    const moveHistory = totalMoves > 0 ? `已進行 ${totalMoves} 步` : '遊戲開始';

    // 優化提示詞以平衡速度和質量
    const prompt = `你是專業的五子棋AI。請分析以下棋盤狀態：

棋盤狀態 (B=黑棋, W=白棋, .=空位):
${boardString}

遊戲信息：
- 當前輪到: ${player === 'black' ? '黑棋' : '白棋'}
- 進度: ${moveHistory}

請快速分析：
1. 當前局面的關鍵威脅
2. 可用的進攻機會
3. 推薦的戰略方向

請用繁體中文回答，保持分析簡潔明確，不超過150字。`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: '你是五子棋專家，快速簡潔分析局面。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.2,
      });

      return response.response || '無法分析當前局面';
    } catch (error) {
      console.error('AI分析失敗，使用快速分析:', error);
      // 如果AI失敗，返回快速分析結果
      return this.getQuickAnalysis(gameState, player);
    }
  }

  /**
   * 選擇最佳落子位置
   */
  private async selectBestMove(
    gameState: GameState,
    availableMoves: Position[],
    player: Player,
    _analysis: string,
    difficulty: 'easy' | 'medium' | 'hard',
    historicalSuggestions?: {
      suggestions: Position[];
      reasoning: string[];
    }
  ): Promise<AIMove> {
    // 過濾掉已佔用的位置
    const validMoves = availableMoves.filter(position =>
      GameLogic.isEmptyPosition(gameState.board, position)
    );

    if (validMoves.length === 0) {
      throw new Error('沒有有效的落子位置');
    }

    // 評估每個可能的位置
    const evaluatedMoves = validMoves.map(position => {
      const score = this.evaluateMove(gameState, position, player);
      let historicalBonus = 0;
      
      // 如果有歷史建議，給予額外分數
      if (historicalSuggestions && historicalSuggestions.suggestions.length > 0) {
        const isHistoricalMove = historicalSuggestions.suggestions.some(
          suggestion => suggestion.row === position.row && suggestion.col === position.col
        );
        if (isHistoricalMove) {
          historicalBonus = 200; // 歷史建議額外加分
        }
      }
      
      return { position, score: score + historicalBonus };
    });

    // 按分數排序
    evaluatedMoves.sort((a, b) => b.score - a.score);

    // 根據難度選擇落子
    let selectedMove: { position: Position; score: number };

    switch (difficulty) {
      case 'easy':
        // 簡單模式：有 30% 機率選擇次優解
        if (Math.random() < 0.3 && evaluatedMoves.length > 1) {
          selectedMove = evaluatedMoves[1]!;
        } else {
          selectedMove = evaluatedMoves[0]!;
        }
        break;

      case 'medium':
        // 中等模式：有 10% 機率選擇次優解
        if (Math.random() < 0.1 && evaluatedMoves.length > 1) {
          selectedMove = evaluatedMoves[1]!;
        } else {
          selectedMove = evaluatedMoves[0]!;
        }
        break;

      case 'hard':
      default:
        // 困難模式：總是選擇最優解
        selectedMove = evaluatedMoves[0]!;
        break;
    }

    // 直接返回落子結果，不生成理由
    return {
      position: selectedMove.position,
      confidence: Math.min(selectedMove.score / 1000, 1.0),
      reasoning: `在 (${selectedMove.position.row}, ${selectedMove.position.col}) 落子`,
    };
  }

  /**
   * 評估單個落子的分數
   */
  private evaluateMove(
    gameState: GameState,
    position: Position,
    player: Player
  ): number {
    let score = 0;

    // 基本位置評估
    score += GameLogic.evaluatePosition(gameState.board, position, player);

    // 防守評估 - 檢查是否需要阻止對手獲勝
    const opponent = GameLogic.getOpponent(player);
    const defensiveScore = GameLogic.evaluatePosition(
      gameState.board,
      position,
      opponent
    );
    score += defensiveScore * 1.1; // 防守稍微重要一些

    // 檢查是否能直接獲勝
    const testBoard = gameState.board.map(row => [...row]);
    const targetRow = testBoard[position.row];
    if (targetRow) {
      targetRow[position.col] = player;
      if (GameLogic.checkWinner(testBoard, position, player)) {
        score += 100000; // 獲勝的位置最高優先級
      }

      // 檢查是否能阻止對手獲勝
      targetRow[position.col] = opponent;
      if (GameLogic.checkWinner(testBoard, position, opponent)) {
        score += 50000; // 阻止對手獲勝也很重要
      }
    }

    return score;
  }


  /**
   * 降級策略：當 AI 失敗時使用基本算法
   */
  private fallbackMove(
    gameState: GameState,
    availableMoves: Position[],
    player: Player
  ): AIMove {
    // 檢查是否能獲勝
    for (const position of availableMoves) {
      const testBoard = gameState.board.map(row => [...row]);
      const targetRow = testBoard[position.row];
      if (targetRow) {
        targetRow[position.col] = player;
        if (GameLogic.checkWinner(testBoard, position, player)) {
          return {
            position,
            confidence: 1.0,
            reasoning: '發現獲勝機會',
          };
        }
      }
    }

    // 檢查是否需要防守
    const opponent = GameLogic.getOpponent(player);
    for (const position of availableMoves) {
      const testBoard = gameState.board.map(row => [...row]);
      const targetRow = testBoard[position.row];
      if (targetRow) {
        targetRow[position.col] = opponent;
        if (GameLogic.checkWinner(testBoard, position, opponent)) {
          return {
            position,
            confidence: 0.8,
            reasoning: '防守對手威脅',
          };
        }
      }
    }

    // 選擇評分最高的位置
    const bestMove = availableMoves.reduce((best, current) => {
      const currentScore = GameLogic.evaluatePosition(
        gameState.board,
        current,
        player
      );
      const bestScore = GameLogic.evaluatePosition(
        gameState.board,
        best,
        player
      );
      return currentScore > bestScore ? current : best;
    });

    return {
      position: bestMove,
      confidence: 0.6,
      reasoning: '選擇戰略位置',
    };
  }

  /**
   * 使用 Text Classification 分析局面優劣勢
   */
  async analyzeGameAdvantage(
    gameState: GameState,
    player: Player
  ): Promise<GameAnalysis> {
    const boardString = GameLogic.boardToString(gameState.board);
    const moveCount = gameState.moves.length;

    // 構建分析文本
    const analysisText = `五子棋局面分析：
棋盤大小：15x15
已下棋子數：${moveCount}
當前玩家：${player === 'black' ? '黑棋' : '白棋'}
棋盤狀態：
${boardString}

分析這個局面對當前玩家是優勢、劣勢還是平局。`;

    try {
      // 使用 Text Classification 判斷優劣勢
      const classificationResult = await this.env.AI.run(
        '@cf/huggingface/distilbert-sst-2-int8',
        {
          text: analysisText,
        }
      );

      // 使用 Text Generation 提供詳細分析
      const detailedAnalysis = await this.env.AI.run(
        '@cf/meta/llama-3-8b-instruct',
        {
          messages: [
            {
              role: 'system',
              content: '你是五子棋專家，請分析局面並判斷優劣勢。',
            },
            {
              role: 'user',
              content: `${analysisText}\n\n請判斷當前局面對${player === 'black' ? '黑棋' : '白棋'}是優勢、劣勢還是平局，並簡述理由。`,
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }
      );

      // 根據分類結果和詳細分析確定優劣勢
      let advantage: 'advantage' | 'disadvantage' | 'draw' = 'draw';
      let confidence = 0.5;

      if (
        classificationResult.label === 'POSITIVE' &&
        classificationResult.score && classificationResult.score > 0.7
      ) {
        advantage = 'advantage';
        confidence = classificationResult.score;
      } else if (
        classificationResult.label === 'NEGATIVE' &&
        classificationResult.score && classificationResult.score > 0.7
      ) {
        advantage = 'disadvantage';
        confidence = classificationResult.score;
      }

      return {
        advantage,
        confidence,
        reasoning: detailedAnalysis.response || '局面分析中...',
      };
    } catch (error) {
      console.error('分析局面優劣勢時發生錯誤:', error);

      // 降級到基本分析
      return this.basicAdvantageAnalysis(gameState, player);
    }
  }

  /**
   * 基本優劣勢分析（降級方案）
   */
  private basicAdvantageAnalysis(
    gameState: GameState,
    player: Player
  ): GameAnalysis {
    const playerMoves = gameState.moves.filter(
      move => move.player === player
    ).length;
    const opponentMoves = gameState.moves.filter(
      move => move.player === GameLogic.getOpponent(player)
    ).length;

    // 簡單的評估邏輯
    let advantage: 'advantage' | 'disadvantage' | 'draw' = 'draw';
    let confidence = 0.5;
    let reasoning = '局面大致平衡';

    if (playerMoves > opponentMoves) {
      advantage = 'advantage';
      confidence = 0.6;
      reasoning = '先手優勢';
    } else if (playerMoves < opponentMoves) {
      advantage = 'disadvantage';
      confidence = 0.6;
      reasoning = '後手劣勢';
    }

    return { advantage, confidence, reasoning };
  }
}
