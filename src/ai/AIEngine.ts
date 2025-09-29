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
    const startTime = Date.now();
    console.log(`[AI] 開始生成落子 - 難度: ${difficulty}, 時間: ${new Date().toISOString()}`);
    
    const aiPlayer = gameState.currentPlayer;
    if (!aiPlayer) {
      throw new Error('無效的玩家');
    }

    // 獲取可能的落子位置
    const movesStartTime = Date.now();
    const availableMoves = GameLogic.getRelevantMoves(gameState.board);
    console.log(`[AI] 獲取可用位置完成 - 耗時: ${Date.now() - movesStartTime}ms, 位置數: ${availableMoves.length}`);

    if (availableMoves.length === 0) {
      throw new Error('沒有可用的落子位置');
    }

    // 檢查是否是第一步（棋盤上沒有任何棋子）
    const isEmpty = gameState.board.every(row =>
      row.every(cell => cell === null)
    );

    if (isEmpty) {
      const center = Math.floor(GameLogic.BOARD_SIZE / 2);
      console.log(`[AI] 開局落子 - 總耗時: ${Date.now() - startTime}ms`);
      return {
        position: { row: center, col: center },
        confidence: 0.9,
        reasoning: '開局選擇中心位置，佔據有利地形',
      };
    }

    try {
      let boardAnalysis: string;
      let historicalSuggestions: { suggestions: Position[]; reasoning: string[] };
      let gameAdvantage: GameAnalysis | null = null;
      
      // 簡單模式使用快速分析，但允許10秒超時
      if (difficulty === 'easy') {
        console.log(`[AI] 簡單模式 - 開始並行分析 (10秒超時)`);
        const analysisStartTime = Date.now();
        
        const analysisPromise = this.analyzeBoardState(gameState, aiPlayer);
        const historyPromise = this.getHistoricalSuggestions(gameState, aiPlayer);
        
        // 簡單模式設置10秒超時
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            console.log(`[AI] 簡單模式分析超時 (10秒)`);
            reject(new Error('AI 分析超時'));
          }, 10000);
        });

        [boardAnalysis, historicalSuggestions] = await Promise.race([
          Promise.all([analysisPromise, historyPromise]),
          timeoutPromise
        ]).catch(() => {
          // 超時時使用快速分析
          console.warn('[AI] 簡單模式AI分析超時，使用快速模式');
          return [this.getQuickAnalysis(gameState, aiPlayer), { suggestions: [], reasoning: ['快速模式'] }];
        });
        
        // 使用基本優勢分析替代Text Classification
        gameAdvantage = this.basicAdvantageAnalysis(gameState, aiPlayer);
        
        console.log(`[AI] 簡單模式分析完成 - 耗時: ${Date.now() - analysisStartTime}ms`);
      } else {
        // 中等和困難模式使用完整分析，但設置超時
        const timeoutMs = difficulty === 'medium' ? 20000 : 30000;
        console.log(`[AI] ${difficulty}模式 - 開始並行分析 (${timeoutMs}ms超時)`);
        const analysisStartTime = Date.now();
        
        const analysisPromise = this.analyzeBoardState(gameState, aiPlayer);
        const historyPromise = this.getHistoricalSuggestions(gameState, aiPlayer);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            console.log(`[AI] ${difficulty}模式分析超時 (${timeoutMs}ms)`);
            reject(new Error('AI 分析超時'));
          }, timeoutMs);
        });

        [boardAnalysis, historicalSuggestions] = await Promise.race([
          Promise.all([analysisPromise, historyPromise]),
          timeoutPromise
        ]).catch(() => {
          // 超時時使用快速分析
          console.warn(`[AI] ${difficulty}模式分析超時，使用快速模式`);
          return [this.getQuickAnalysis(gameState, aiPlayer), { suggestions: [], reasoning: [] }];
        });
        
        // 使用基本優勢分析替代Text Classification
        gameAdvantage = this.basicAdvantageAnalysis(gameState, aiPlayer);
        
        console.log(`[AI] ${difficulty}模式分析完成 - 耗時: ${Date.now() - analysisStartTime}ms`);
      }

      // 根據分析結果、歷史建議和難度選擇最佳落子
      const selectStartTime = Date.now();
      const bestMove = await this.selectBestMove(
        gameState,
        availableMoves,
        aiPlayer,
        boardAnalysis,
        difficulty,
        historicalSuggestions,
        gameAdvantage
      );
      console.log(`[AI] 選擇最佳落子完成 - 耗時: ${Date.now() - selectStartTime}ms`);
      console.log(`[AI] 總生成時間: ${Date.now() - startTime}ms`);

      return bestMove;
    } catch (error) {
      console.error(`[AI] 生成落子時發生錯誤 (總耗時: ${Date.now() - startTime}ms):`, error);

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
    const startTime = Date.now();
    console.log(`[AI] 開始獲取歷史建議`);
    
    try {
      // 設置10秒超時，如果超時則返回空建議
      const timeoutPromise = new Promise<{ suggestions: Position[]; reasoning: string[] }>((_, reject) => {
        setTimeout(() => {
          console.log(`[AI] 歷史建議超時 (10秒)`);
          reject(new Error('歷史建議超時'));
        }, 10000);
      });

      const result = await Promise.race([
        this.vectorizeService.getHistoricalMovesSuggestions(gameState),
        timeoutPromise
      ]);
      
      console.log(`[AI] 歷史建議完成 - 耗時: ${Date.now() - startTime}ms, 建議數: ${result.suggestions.length}`);
      return result;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.warn(`[AI] 獲取歷史建議失敗 (耗時: ${errorTime}ms)，使用快速模式:`, error);
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
    const startTime = Date.now();
    console.log(`[AI] 開始棋盤狀態分析 - ${player}`);
    
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
    const prompt = `你是五子棋專家，快速簡潔分析以下棋盤狀態：

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
      console.log(`[AI] 調用Llama模型分析棋盤狀態`);
      const llamaStartTime = Date.now();
      
      const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
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

      const llamaTime = Date.now() - llamaStartTime;
      console.log(`[AI] Llama模型分析完成 - 耗時: ${llamaTime}ms`);
      console.log(`[AI] 棋盤狀態分析總耗時: ${Date.now() - startTime}ms`);

      return response.response || '無法分析當前局面';
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(`[AI] 棋盤狀態分析失敗 (耗時: ${errorTime}ms)，使用快速分析:`, error);
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
    analysis: string,
    difficulty: 'easy' | 'medium' | 'hard',
    historicalSuggestions?: {
      suggestions: Position[];
      reasoning: string[];
    },
    gameAdvantage?: GameAnalysis | null
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
      let aiAnalysisBonus = 0;
      let advantageBonus = 0;
      
      // 如果有歷史建議，給予額外分數
      if (historicalSuggestions && historicalSuggestions.suggestions.length > 0) {
        const isHistoricalMove = historicalSuggestions.suggestions.some(
          suggestion => suggestion.row === position.row && suggestion.col === position.col
        );
        if (isHistoricalMove) {
          historicalBonus = 200; // 歷史建議額外加分
        }
      }
      
      // 根據AI分析結果調整分數
      if (analysis && analysis.length > 0) {
        // 如果AI分析提到防守，對防守位置加分
        if (analysis.includes('防守') || analysis.includes('威脅')) {
          const isDefensiveMove = this.isDefensiveMove(gameState, position, player);
          if (isDefensiveMove) {
            aiAnalysisBonus = 150;
          }
        }
        
        // 如果AI分析提到進攻，對進攻位置加分
        if (analysis.includes('進攻') || analysis.includes('機會')) {
          const isOffensiveMove = this.isOffensiveMove(gameState, position, player);
          if (isOffensiveMove) {
            aiAnalysisBonus = 150;
          }
        }
      }
      
      // 根據局面優劣勢調整分數
      if (gameAdvantage) {
        const isDefensiveMove = this.isDefensiveMove(gameState, position, player);
        const isOffensiveMove = this.isOffensiveMove(gameState, position, player);
        
        switch (gameAdvantage.advantage) {
          case 'disadvantage':
            // 劣勢時優先防守，對防守位置大幅加分
            if (isDefensiveMove) {
              advantageBonus = 300 * gameAdvantage.confidence;
            }
            break;
          case 'advantage':
            // 優勢時優先進攻，對進攻位置大幅加分
            if (isOffensiveMove) {
              advantageBonus = 300 * gameAdvantage.confidence;
            }
            break;
          case 'draw':
            // 平局時平衡考慮，給予適度加分
            if (isDefensiveMove || isOffensiveMove) {
              advantageBonus = 100 * gameAdvantage.confidence;
            }
            break;
        }
      }
      
      return { position, score: score + historicalBonus + aiAnalysisBonus + advantageBonus };
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
   * 判斷是否為防守性落子
   */
  private isDefensiveMove(gameState: GameState, position: Position, player: Player): boolean {
    const opponent = player === 'black' ? 'white' : 'black';
    
    // 模擬在這個位置落子
    const testBoard = gameState.board.map(row => [...row]);
    if (testBoard[position.row] && testBoard[position.row]![position.col] === null) {
      testBoard[position.row]![position.col] = player;
    }
    
    // 檢查是否阻止了對手的連線
    return this.hasImmediateThreats(testBoard, opponent);
  }

  /**
   * 判斷是否為進攻性落子
   */
  private isOffensiveMove(gameState: GameState, position: Position, player: Player): boolean {
    // 模擬在這個位置落子
    const testBoard = gameState.board.map(row => [...row]);
    if (testBoard[position.row] && testBoard[position.row]![position.col] === null) {
      testBoard[position.row]![position.col] = player;
    }
    
    // 檢查是否創造了進攻機會
    return this.hasImmediateOpportunities(testBoard, player);
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
