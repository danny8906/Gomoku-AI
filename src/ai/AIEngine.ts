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

/** 模型指名的一個座標建議 */
interface AdvicePoint {
  row: number;
  col: number;
  weight: number;
}

/** 模型回傳的結構化盤面建議 */
interface BoardAdvice {
  /** 建議優先防守的點 */
  threats: AdvicePoint[];
  /** 建議優先進攻的點 */
  opportunities: AdvicePoint[];
  /** 給玩家看的簡短說明 */
  strategy: string;
}

const EMPTY_ADVICE: BoardAdvice = {
  threats: [],
  opportunities: [],
  strategy: '',
};

/**
 * 模型建議的加分權重
 *
 * 上限刻意遠低於 evaluateMove 給「能直接獲勝」(100000) 與
 * 「能擋下對手獲勝」(50000) 的加權：模型只能在雙方棋型相當時左右選點，
 * 不可能蓋過戰術上的必然手。語言模型在 15x15 盤面上的空間推理並不可靠，
 * 因此它的意見必須是加權建議，而不是決策權。
 */
const ADVICE_WEIGHTS: Record<string, number> = {
  critical: 2000,
  high: 1000,
  medium: 400,
};

/** 每類建議最多採納幾點，避免模型灑點洗掉評分差異 */
const MAX_ADVICE_POINTS = 4;

/** 盤面分析使用的模型（Workers AI model id） */
const ANALYSIS_MODEL = '@cf/zai-org/glm-4.7-flash';

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
      const timeoutMs =
        difficulty === 'easy' ? 10000 : difficulty === 'medium' ? 20000 : 30000;

      console.log(`[AI] ${difficulty}模式 - 開始並行分析 (${timeoutMs}ms超時)`);
      const analysisStartTime = Date.now();

      const [advice, historicalSuggestions] = await this.gatherAnalysis(
        gameState,
        aiPlayer,
        timeoutMs
      );
      const gameAdvantage = this.basicAdvantageAnalysis(gameState, aiPlayer);

      console.log(
        `[AI] ${difficulty}模式分析完成 - 耗時: ${Date.now() - analysisStartTime}ms` +
          `, 威脅點: ${advice.threats.length}, 機會點: ${advice.opportunities.length}`
      );

      // 根據分析結果、歷史建議和難度選擇最佳落子
      const selectStartTime = Date.now();
      const bestMove = await this.selectBestMove(
        gameState,
        availableMoves,
        aiPlayer,
        advice,
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
   * 並行取得模型建議與歷史棋譜建議，逾時則退回純啟發式評估
   */
  private async gatherAnalysis(
    gameState: GameState,
    player: Player,
    timeoutMs: number
  ): Promise<
    [BoardAdvice, { suggestions: Position[]; reasoning: string[] }]
  > {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI 分析超時')), timeoutMs);
    });

    try {
      return await Promise.race([
        Promise.all([
          this.analyzeBoard(gameState, player),
          this.getHistoricalSuggestions(gameState, player),
        ]),
        timeoutPromise,
      ]);
    } catch (error) {
      console.warn(
        `[AI] 分析未於 ${timeoutMs}ms 內完成，改用純啟發式評估:`,
        error
      );
      return [EMPTY_ADVICE, { suggestions: [], reasoning: [] }];
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
   * 使用 Workers AI 分析棋盤，取得結構化的威脅與機會座標
   */
  private async analyzeBoard(
    gameState: GameState,
    player: Player
  ): Promise<BoardAdvice> {
    const startTime = Date.now();
    const boardString = this.renderBoardWithCoordinates(gameState.board);
    const me = player === 'black' ? 'B（黑棋）' : 'W（白棋）';
    const rival = player === 'black' ? 'W（白棋）' : 'B（黑棋）';

    const prompt = `你是五子棋專家。棋盤為 15x15，行列編號皆為 0 到 14。

棋盤（B=黑棋, W=白棋, .=空位，最上方為列號，最左方為行號）:
${boardString}

你執 ${me}，對手執 ${rival}，現在輪到你下。

請找出：
- threats：若不處理、對手下一手就會取得重大優勢的「空位」座標（防守點）
- opportunities：你下了之後能取得重大優勢的「空位」座標（進攻點）

嚴格規則：
1. 只能回報目前是「.」的空位，不可回報已有棋子的位置。
2. row 與 col 都必須是 0 到 14 的整數。
3. severity 只能是 "critical"、"high"、"medium" 其中之一。
4. 每個陣列最多 ${MAX_ADVICE_POINTS} 個座標，寧缺勿濫，沒有就給空陣列。
5. 只輸出 JSON，不要有任何說明文字或 markdown 標記。

輸出格式：
{"threats":[{"row":7,"col":8,"severity":"critical"}],"opportunities":[{"row":5,"col":5,"severity":"high"}],"strategy":"一句話戰略說明，繁體中文，40字以內"}`;

    try {
      const response = (await this.env.AI.run(ANALYSIS_MODEL, {
        messages: [
          {
            role: 'system',
            content:
              '你是五子棋專家，只輸出符合要求的 JSON，不輸出任何其他內容。',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.1,
        // GLM 預設會先輸出一長串思考內容，實測要 27~45 秒且常在產出答案前
        // 就耗盡 token（finish_reason=length）。關閉思考後同一題約 2 秒完成。
        chat_template_kwargs: { enable_thinking: false },
      }));

      const advice = this.parseAdvice(
        this.extractAdvicePayload(response),
        gameState.board
      );

      console.log(
        `[AI] 模型分析完成 - 耗時: ${Date.now() - startTime}ms` +
          `, 採納威脅點 ${advice.threats.length}, 機會點 ${advice.opportunities.length}`
      );

      return advice;
    } catch (error) {
      console.error(
        `[AI] 模型分析失敗 (耗時: ${Date.now() - startTime}ms)，本手不採納模型建議:`,
        error
      );
      return EMPTY_ADVICE;
    }
  }

  /**
   * 把 Workers AI 的回傳正規化成物件
   *
   * 同一個 AI binding 對不同模型有三種形狀，實測確認：
   *   - { response: 已解析的物件 }          llama 系列（Workers AI 會自動 parse JSON）
   *   - { response: "字串" }                 舊式文字回覆
   *   - { choices: [{ message: { content } }] }  OpenAI 格式（GLM 等）
   * 只認其中一種就會在換模型時靜默拿到空建議。
   */
  private extractAdvicePayload(result: unknown): unknown {
    const res = result as {
      response?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
    };

    if (res?.response && typeof res.response === 'object') {
      return res.response;
    }

    const content = res?.choices?.[0]?.message?.content;
    const text =
      typeof res?.response === 'string'
        ? res.response
        : typeof content === 'string'
          ? content
          : null;

    if (text === null) {
      console.warn('[AI] 無法從模型回覆取出內容，忽略本次建議');
      return null;
    }

    // 模型常會加上 ```json 圍欄或前後贅字，取最外層的大括號
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end <= start) {
      console.warn('[AI] 模型回覆中找不到 JSON，忽略本次建議');
      return null;
    }

    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      console.warn('[AI] 模型回覆不是合法 JSON，忽略本次建議');
      return null;
    }
  }

  /**
   * 驗證模型回傳的建議
   *
   * 語言模型在盤面上的空間推理並不可靠，回傳越界、已有棋子、
   * 甚至非數字的座標都很常見（實測就出現過指向已有棋子的點），
   * 因此每一點都必須逐一驗證後才採納。
   */
  private parseAdvice(payload: unknown, board: Player[][]): BoardAdvice {
    if (!payload || typeof payload !== 'object') {
      return EMPTY_ADVICE;
    }

    const source = payload as {
      threats?: unknown;
      opportunities?: unknown;
      strategy?: unknown;
    };

    const toPoints = (value: unknown, label: string): AdvicePoint[] => {
      if (!Array.isArray(value)) return [];

      const points: AdvicePoint[] = [];

      for (const entry of value) {
        if (points.length >= MAX_ADVICE_POINTS) break;

        const item = entry as {
          row?: unknown;
          col?: unknown;
          severity?: unknown;
        };
        const row = Number(item?.row);
        const col = Number(item?.col);

        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        if (!GameLogic.isValidPosition({ row, col })) continue;
        // 已有棋子的位置不可能是落子建議
        if (!GameLogic.isEmptyPosition(board, { row, col })) {
          console.warn(`[AI] 模型建議的${label} (${row},${col}) 已有棋子，捨棄`);
          continue;
        }
        // 同一點只採納一次
        if (points.some(p => p.row === row && p.col === col)) continue;

        const severity =
          typeof item.severity === 'string' ? item.severity : 'medium';
        points.push({
          row,
          col,
          weight: ADVICE_WEIGHTS[severity] ?? ADVICE_WEIGHTS.medium!,
        });
      }

      return points;
    };

    const strategy =
      typeof source.strategy === 'string' ? source.strategy.slice(0, 120) : '';

    return {
      threats: toPoints(source.threats, '防守點'),
      opportunities: toPoints(source.opportunities, '進攻點'),
      strategy,
    };
  }

  /**
   * 選擇最佳落子位置
   */
  private async selectBestMove(
    gameState: GameState,
    availableMoves: Position[],
    player: Player,
    advice: BoardAdvice,
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
      
      // 採納模型指名的座標：先前是比對回覆裡有沒有「防守/進攻」等字眼，
      // 而提示詞本身就要求模型談這些，等於恆真，模型實際上沒有參與決策。
      // 現在改為只有模型明確指到這一點才加分，權重依嚴重程度。
      const threat = advice.threats.find(
        p => p.row === position.row && p.col === position.col
      );
      if (threat) {
        aiAnalysisBonus += threat.weight;
      }

      const opportunity = advice.opportunities.find(
        p => p.row === position.row && p.col === position.col
      );
      if (opportunity) {
        aiAnalysisBonus += opportunity.weight;
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

    return {
      position: selectedMove.position,
      confidence: Math.min(selectedMove.score / 1000, 1.0),
      reasoning:
        advice.strategy ||
        `在 (${selectedMove.position.row}, ${selectedMove.position.col}) 落子`,
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
