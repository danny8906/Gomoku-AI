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

export class AIEngine {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
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
      // 使用 AI 分析當前局面
      const boardAnalysis = await this.analyzeBoardState(gameState, aiPlayer);

      // 根據分析結果和難度選擇最佳落子
      const bestMove = await this.selectBestMove(
        gameState,
        availableMoves,
        aiPlayer,
        boardAnalysis,
        difficulty
      );

      return bestMove;
    } catch (error) {
      console.error('AI 生成落子時發生錯誤:', error);

      // 降級到基本策略
      return this.fallbackMove(gameState, availableMoves, aiPlayer);
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

    const prompt = `你是一個專業的五子棋 AI。請分析以下棋盤狀態：

棋盤狀態 (B=黑棋, W=白棋, .=空位):
${boardString}

最近的落子記錄: ${moveHistory}
當前輪到: ${player === 'black' ? '黑棋' : '白棋'}

請分析：
1. 當前局面的優劣勢
2. 關鍵的威脅和機會
3. 推薦的策略方向
4. 需要防守的位置
5. 可以進攻的位置

請用繁體中文回答，並保持分析簡潔明確。`;

    const response = await this.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [
        {
          role: 'system',
          content: '你是一個專業的五子棋分析師，擅長分析棋局並提供戰略建議。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    return response.response || '無法分析當前局面';
  }

  /**
   * 選擇最佳落子位置
   */
  private async selectBestMove(
    gameState: GameState,
    availableMoves: Position[],
    player: Player,
    analysis: string,
    difficulty: 'easy' | 'medium' | 'hard'
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
      return { position, score };
    });

    // 按分數排序
    evaluatedMoves.sort((a, b) => b.score - a.score);

    // 根據難度選擇落子
    let selectedMove: { position: Position; score: number };

    switch (difficulty) {
      case 'easy':
        // 簡單模式：有 30% 機率選擇次優解
        if (Math.random() < 0.3 && evaluatedMoves.length > 1) {
          selectedMove = evaluatedMoves[1];
        } else {
          selectedMove = evaluatedMoves[0];
        }
        break;

      case 'medium':
        // 中等模式：有 10% 機率選擇次優解
        if (Math.random() < 0.1 && evaluatedMoves.length > 1) {
          selectedMove = evaluatedMoves[1];
        } else {
          selectedMove = evaluatedMoves[0];
        }
        break;

      case 'hard':
      default:
        // 困難模式：總是選擇最優解
        selectedMove = evaluatedMoves[0];
        break;
    }

    // 使用 AI 生成落子理由
    const reasoning = await this.generateMoveReasoning(
      gameState,
      selectedMove.position,
      player,
      analysis
    );

    return {
      position: selectedMove.position,
      confidence: Math.min(selectedMove.score / 1000, 1.0),
      reasoning,
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
   * 生成落子理由
   */
  private async generateMoveReasoning(
    gameState: GameState,
    position: Position,
    player: Player,
    analysis: string
  ): Promise<string> {
    const prompt = `基於以下分析：
${analysis}

我選擇在 (${position.row}, ${position.col}) 落子。請簡潔說明這步棋的戰略意圖，不超過 50 字。`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
        messages: [
          {
            role: 'system',
            content: '你是五子棋專家，請簡潔說明落子理由。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.5,
      });

      return (
        response.response ||
        `在 (${position.row}, ${position.col}) 落子以鞏固優勢`
      );
    } catch (error) {
      console.error('生成落子理由時發生錯誤:', error);
      return `在 (${position.row}, ${position.col}) 落子`;
    }
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
      testBoard[position.row][position.col] = player;
      if (GameLogic.checkWinner(testBoard, position, player)) {
        return {
          position,
          confidence: 1.0,
          reasoning: '發現獲勝機會',
        };
      }
    }

    // 檢查是否需要防守
    const opponent = GameLogic.getOpponent(player);
    for (const position of availableMoves) {
      const testBoard = gameState.board.map(row => [...row]);
      testBoard[position.row][position.col] = opponent;
      if (GameLogic.checkWinner(testBoard, position, opponent)) {
        return {
          position,
          confidence: 0.8,
          reasoning: '防守對手威脅',
        };
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
        '@cf/meta/llama-4-scout-17b-16e-instruct',
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
        classificationResult.score > 0.7
      ) {
        advantage = 'advantage';
        confidence = classificationResult.score;
      } else if (
        classificationResult.label === 'NEGATIVE' &&
        classificationResult.score > 0.7
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
