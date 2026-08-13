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
import { PatternService } from '../database/PatternService';

/**
 * 講評使用的模型（Workers AI model id）
 *
 * 語言模型不參與選點，只負責產生給玩家看的自然語言講評。
 *
 * 依據：以 7 個關鍵盤面各取樣 3 次評測，模型「找出全部關鍵點」的完整率為
 * llama-3.3-70b 44%、glm-4.7-flash 38%、mistral-small 35%、granite 29%；
 * 跳三全數 0%、斜向活三近乎 0%，且每次回覆平均會指向 1~5 個已有棋子的座標。
 * 同一組盤面下，本檔的 evaluateMove 啟發式是 100% 正確（見 test/tactics.test.ts）。
 * 因此落子完全交給啟發式，模型只做它擅長的事：用自然語言描述局面。
 */
const COMMENTARY_MODEL = '@cf/zai-org/glm-4.7-flash';

/** 講評的長度上限，避免塞爆 KV 與前端版面 */
const MAX_COMMENTARY_LENGTH = 200;

export class AIEngine {
  private env: Env;
  private patternService: PatternService;

  constructor(env: Env) {
    this.env = env;
    this.patternService = new PatternService(env);
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
      const analysisStartTime = Date.now();

      // 落子不再等待語言模型：模型的戰術完整率遠低於本檔的啟發式，
      // 卻要花數秒阻塞玩家。講評改由 waitUntil 於回應之後非同步產生。
      const historicalSuggestions = await this.getHistoricalSuggestions(
        gameState,
        aiPlayer
      );
      const gameAdvantage = this.basicAdvantageAnalysis(gameState, aiPlayer);

      console.log(
        `[AI] 分析完成 - 耗時: ${Date.now() - analysisStartTime}ms` +
          `, 歷史建議: ${historicalSuggestions.suggestions.length}`
      );

      // 根據歷史建議、局面優劣勢和難度選擇最佳落子
      const selectStartTime = Date.now();
      const bestMove = await this.selectBestMove(
        gameState,
        availableMoves,
        aiPlayer,
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
   * 從 Workers AI 的回傳取出文字
   *
   * 同一個 AI binding 對不同模型有不同形狀，實測確認：
   *   - { response: "字串" }                     llama 系列
   *   - { choices: [{ message: { content } }] }  OpenAI 格式（GLM 等）
   * 只認其中一種，換模型時會靜默拿到空字串。
   */
  private extractText(result: unknown): string {
    const res = result as {
      response?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
    };

    if (typeof res?.response === 'string') {
      return res.response;
    }

    const content = res?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  }

  /**
   * 產生給玩家看的局勢講評
   *
   * 這是語言模型在本專案唯一的職責：它不參與選點，只把局面翻譯成自然語言。
   * 必須在回應送出後以 waitUntil 呼叫，不可放在落子的關鍵路徑上。
   */
  async generateCommentary(
    gameState: GameState,
    _player: Player
  ): Promise<string> {
    const startTime = Date.now();
    const lastMove = gameState.moves[gameState.moves.length - 1];
    const boardString = this.renderBoardWithCoordinates(gameState.board);

    const prompt = `你是五子棋講評員。棋盤 15x15，行列編號 0 到 14。

棋盤（B=黑棋, W=白棋, .=空位）:
${boardString}

黑棋是玩家，白棋是 AI。${
      lastMove
        ? `最後一手是${lastMove.player === 'black' ? '黑棋' : '白棋'}下在 (${lastMove.position.row}, ${lastMove.position.col})。`
        : ''
    }
已進行 ${gameState.moves.length} 手。

請用繁體中文寫一段 60 字以內的局勢講評，說明目前雙方的態勢與接下來的重點。
只輸出講評文字，不要列座標清單、不要 JSON、不要 markdown。`;

    try {
      const result = await this.env.AI.run(COMMENTARY_MODEL, {
        messages: [
          {
            role: 'system',
            content: '你是五子棋講評員，用繁體中文簡潔講評，不超過60字。',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.6,
        // GLM 預設會輸出大量思考內容，實測會耗盡 token 且從不產出答案
        chat_template_kwargs: { enable_thinking: false },
      });

      const text = this.extractText(result).trim();

      console.log(
        `[AI] 講評產生完成 - 耗時: ${Date.now() - startTime}ms, 長度: ${text.length}`
      );

      return text.slice(0, MAX_COMMENTARY_LENGTH);
    } catch (error) {
      console.error(
        `[AI] 講評產生失敗 (耗時: ${Date.now() - startTime}ms):`,
        error
      );
      return '';
    }
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
   *
   * 改用局部棋型的精確比對，不再走文字 embedding 的相似度檢索
   * （實測相似度無法分辨盤面，等同隨機挑舊局）。
   * 現在只是一次帶索引的 D1 查詢，不需要模型推論，也不需要超時保護。
   */
  private async getHistoricalSuggestions(
    gameState: GameState,
    _player: Player
  ): Promise<{
    suggestions: Position[];
    reasoning: string[];
  }> {
    return this.patternService.suggest(gameState);
  }

  /**
   * 把棋盤畫成帶行列座標的格式
   *
   * 原本送給模型的是不含座標的字串，模型即使看懂局面也無法指出「哪一點」，
   * 這是它先前完全無法參與決策的根本原因。
   */
  private renderBoardWithCoordinates(board: Player[][]): string {
    const header =
      '    ' +
      Array.from({ length: GameLogic.BOARD_SIZE }, (_, c) =>
        c.toString().padStart(2, ' ')
      ).join(' ');

    const rows = board.map((row, r) => {
      const cells = row
        .map(cell => (cell === 'black' ? ' B' : cell === 'white' ? ' W' : ' .'))
        .join(' ');
      return `${r.toString().padStart(2, ' ')}  ${cells}`;
    });

    return [header, ...rows].join('\n');
  }

  /**
   * 選擇最佳落子位置
   */
  private async selectBestMove(
    gameState: GameState,
    availableMoves: Position[],
    player: Player,
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
      
      return { position, score: score + historicalBonus + advantageBonus };
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

    return {
      position: selectedMove.position,
      confidence: Math.min(selectedMove.score / 1000, 1.0),
      reasoning: `在 (${selectedMove.position.row}, ${selectedMove.position.col}) 落子`,
    };
  }

  /**
   * 判斷是否為防守性落子：對手若搶下此點會不會形成四以上
   *
   * 舊版是把我方棋子放上去後呼叫 hasImmediateThreats(board, opponent)，
   * 而該函式內部檢查的是「參數的對手」，等於繞回檢查我方，
   * 導致真正的擋點回報 false、我方成四反而回報 true，
   * 且與 isOffensiveMove 完全等價。
   */
  private isDefensiveMove(
    gameState: GameState,
    position: Position,
    player: Player
  ): boolean {
    const opponent = GameLogic.getOpponent(player);
    const testBoard = gameState.board.map(row => [...row]);
    testBoard[position.row]![position.col] = opponent;

    return (
      this.checkConsecutiveCount(
        testBoard,
        position.row,
        position.col,
        opponent
      ) >= 4
    );
  }

  /**
   * 判斷是否為進攻性落子：我方下在此點會不會形成四以上
   */
  private isOffensiveMove(
    gameState: GameState,
    position: Position,
    player: Player
  ): boolean {
    const testBoard = gameState.board.map(row => [...row]);
    testBoard[position.row]![position.col] = player;

    return (
      this.checkConsecutiveCount(
        testBoard,
        position.row,
        position.col,
        player
      ) >= 4
    );
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
    // 舊版只比較雙方棋子數。五子棋輪到白方時黑方必定多一子，
    // 因此 AI 永遠被判為「後手劣勢」，完全不帶盤面資訊。
    // 改為比較雙方在同一批要點上能取得的最佳棋型分數。
    const opponent = GameLogic.getOpponent(player);
    const candidates = GameLogic.getRelevantMoves(gameState.board);

    let bestSelf = 0;
    let bestOpponent = 0;

    for (const position of candidates) {
      bestSelf = Math.max(
        bestSelf,
        GameLogic.evaluatePosition(gameState.board, position, player)
      );
      bestOpponent = Math.max(
        bestOpponent,
        GameLogic.evaluatePosition(gameState.board, position, opponent)
      );
    }

    const total = bestSelf + bestOpponent;

    if (total === 0) {
      return {
        advantage: 'draw',
        confidence: 0.5,
        reasoning: '開局階段，雙方尚未形成棋型',
      };
    }

    const share = bestSelf / total;
    const confidence = Math.min(0.95, 0.5 + Math.abs(share - 0.5));

    if (share > 0.6) {
      return {
        advantage: 'advantage',
        confidence,
        reasoning: '我方棋型較強，可續行進攻',
      };
    }

    if (share < 0.4) {
      return {
        advantage: 'disadvantage',
        confidence,
        reasoning: '對手棋型較強，應優先防守',
      };
    }

    return { advantage: 'draw', confidence, reasoning: '雙方棋型相當' };
  }
}
