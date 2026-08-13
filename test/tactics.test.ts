/**
 * 戰術正確性：確認純啟發式評估（不依賴任何語言模型）
 * 在關鍵盤面上都會選出正確的一手。
 *
 * 這組盤面同時被用來評測 Workers AI 各模型，結果是最好的模型
 * 平均只有約 45% 的完整率，而下列評估在每一題都必須 100% 正確。
 */
import { describe, it, expect } from 'vitest';
import { AIEngine } from '../src/ai/AIEngine';
import { GameLogic } from '../src/game/GameLogic';
import type { Env, GameState, Player, Position } from '../src/types';

type Cell = [number, number, 'B' | 'W'];

function boardOf(stones: Cell[]): Player[][] {
  const board: Player[][] = Array(15)
    .fill(null)
    .map(() => Array(15).fill(null));
  for (const [r, c, v] of stones) {
    board[r]![c] = v === 'B' ? 'black' : 'white';
  }
  return board;
}

function stateOf(board: Player[][]): GameState {
  return {
    id: 'tactics',
    board,
    currentPlayer: 'white',
    status: 'playing',
    mode: 'ai',
    moves: [],
    winner: null,
    players: { black: 'p' },
    createdAt: 0,
    updatedAt: 0,
  };
}

const engine = new AIEngine({} as Env) as any;

/** 以純啟發式評分挑出最高分的一手 */
function bestHeuristicMove(board: Player[][]): Position {
  const state = stateOf(board);
  const candidates = GameLogic.getRelevantMoves(board);

  let best = candidates[0]!;
  let bestScore = -Infinity;

  for (const position of candidates) {
    const score = engine.evaluateMove(state, position, 'white');
    if (score > bestScore) {
      bestScore = score;
      best = position;
    }
  }

  return best;
}

const key = (p: Position) => `(${p.row},${p.col})`;

describe('關鍵盤面的戰術判斷（純啟發式，無語言模型）', () => {
  const cases: Array<{ name: string; stones: Cell[]; accept: string[] }> = [
    {
      name: '沖四：必須擋唯一活點',
      stones: [
        [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], [7, 7, 'B'],
        [7, 3, 'W'], [9, 9, 'W'],
      ],
      accept: ['(7,8)'],
    },
    {
      name: '橫向活三：必須擋其中一端',
      stones: [
        [7, 5, 'B'], [7, 6, 'B'], [7, 7, 'B'],
        [6, 6, 'W'], [8, 8, 'W'], [5, 7, 'W'],
      ],
      accept: ['(7,4)', '(7,8)'],
    },
    {
      name: '跳三：必須補中間的洞',
      stones: [
        [7, 5, 'B'], [7, 6, 'B'], [7, 8, 'B'],
        [6, 6, 'W'], [9, 9, 'W'],
      ],
      accept: ['(7,7)'],
    },
    {
      name: '斜向活三：必須擋對角線',
      stones: [
        [5, 5, 'B'], [6, 6, 'B'], [7, 7, 'B'],
        [6, 7, 'W'], [9, 2, 'W'],
      ],
      accept: ['(4,4)', '(8,8)'],
    },
    {
      name: '雙活三：必須擋在其中一條線上',
      stones: [
        [7, 5, 'B'], [7, 6, 'B'], [7, 7, 'B'],
        [5, 7, 'B'], [6, 7, 'B'],
        [2, 2, 'W'], [11, 11, 'W'],
      ],
      accept: ['(7,4)', '(7,8)', '(4,7)', '(8,7)'],
    },
    {
      name: '我方沖四：必須直接取勝而非防守',
      stones: [
        [9, 3, 'W'], [9, 4, 'W'], [9, 5, 'W'], [9, 6, 'W'],
        [2, 2, 'B'], [3, 3, 'B'],
      ],
      accept: ['(9,2)', '(9,7)'],
    },
  ];

  for (const { name, stones, accept } of cases) {
    it(name, () => {
      const chosen = key(bestHeuristicMove(boardOf(stones)));
      expect(accept).toContain(chosen);
    });
  }

  it('自己能贏時優先取勝，不會先去擋對手', () => {
    // 白棋可於 (9,7) 五連取勝；黑棋同時有活三威脅
    const board = boardOf([
      [9, 3, 'W'], [9, 4, 'W'], [9, 5, 'W'], [9, 6, 'W'],
      [2, 3, 'B'], [2, 4, 'B'], [2, 5, 'B'],
    ]);

    expect(['(9,2)', '(9,7)']).toContain(key(bestHeuristicMove(board)));
  });
});
