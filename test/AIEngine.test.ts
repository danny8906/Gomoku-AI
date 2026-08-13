import { describe, it, expect } from 'vitest';
import { AIEngine } from '../src/ai/AIEngine';
import type { Env, GameState, Player, Position } from '../src/types';

function emptyBoard(): Player[][] {
  return Array(15)
    .fill(null)
    .map(() => Array(15).fill(null));
}

function state(board: Player[][], moves: { player: Player }[] = []): GameState {
  return {
    id: 'test',
    board,
    currentPlayer: 'white',
    status: 'playing',
    mode: 'ai',
    moves: moves as never,
    winner: null,
    players: { black: 'p' },
    createdAt: 0,
    updatedAt: 0,
  };
}

// 這些是私有方法，測試刻意繞過封裝以鎖住已修復的行為
const engine = new AIEngine({} as Env) as any;

describe('isDefensiveMove / isOffensiveMove', () => {
  it('擋下對手四連的點是防守而非進攻', () => {
    const board = emptyBoard();
    for (const col of [3, 4, 5, 6]) board[7]![col] = 'black';
    const pos: Position = { row: 7, col: 7 };

    expect(engine.isDefensiveMove(state(board), pos, 'white')).toBe(true);
    expect(engine.isOffensiveMove(state(board), pos, 'white')).toBe(false);
  });

  it('自己連成四的點是進攻而非防守', () => {
    const board = emptyBoard();
    for (const col of [3, 4, 5]) board[9]![col] = 'white';
    const pos: Position = { row: 9, col: 6 };

    expect(engine.isDefensiveMove(state(board), pos, 'white')).toBe(false);
    expect(engine.isOffensiveMove(state(board), pos, 'white')).toBe(true);
  });

  it('無關的空點兩者皆否', () => {
    const board = emptyBoard();
    board[7]![7] = 'black';

    const pos: Position = { row: 0, col: 0 };
    expect(engine.isDefensiveMove(state(board), pos, 'white')).toBe(false);
    expect(engine.isOffensiveMove(state(board), pos, 'white')).toBe(false);
  });
});

describe('basicAdvantageAnalysis', () => {
  it('對手棋型較強時判定為劣勢', () => {
    const board = emptyBoard();
    for (const col of [3, 4, 5]) board[7]![col] = 'black';

    expect(engine.basicAdvantageAnalysis(state(board), 'white').advantage).toBe(
      'disadvantage'
    );
  });

  it('我方棋型較強時判定為優勢', () => {
    const board = emptyBoard();
    for (const col of [3, 4, 5]) board[7]![col] = 'white';

    expect(engine.basicAdvantageAnalysis(state(board), 'white').advantage).toBe(
      'advantage'
    );
  });

  it('判定結果取決於盤面，而非雙方棋子數', () => {
    // 棋子數相同的兩個盤面，因棋型不同必須得到不同結論
    const mine = emptyBoard();
    for (const col of [3, 4, 5]) mine[7]![col] = 'white';

    const theirs = emptyBoard();
    for (const col of [3, 4, 5]) theirs[7]![col] = 'black';

    const a = engine.basicAdvantageAnalysis(state(mine), 'white').advantage;
    const b = engine.basicAdvantageAnalysis(state(theirs), 'white').advantage;

    expect(a).not.toBe(b);
  });
});

describe('extractAdvicePayload', () => {
  const obj = { threats: [{ row: 7, col: 8, severity: 'critical' }] };

  it('llama 形狀：response 已是解析好的物件', () => {
    expect(engine.extractAdvicePayload({ response: obj })).toEqual(obj);
  });

  it('舊式形狀：response 是 JSON 字串', () => {
    expect(engine.extractAdvicePayload({ response: JSON.stringify(obj) })).toEqual(
      obj
    );
  });

  it('OpenAI 形狀：choices[0].message.content', () => {
    expect(
      engine.extractAdvicePayload({
        choices: [{ message: { content: JSON.stringify(obj) } }],
      })
    ).toEqual(obj);
  });

  it('容忍 markdown 圍欄與前後贅字', () => {
    const raw = '好的：\n```json\n' + JSON.stringify(obj) + '\n```';
    expect(engine.extractAdvicePayload({ response: raw })).toEqual(obj);
  });

  it('推理模型的 content 為 null 時回傳 null 而非拋錯', () => {
    expect(
      engine.extractAdvicePayload({ choices: [{ message: { content: null } }] })
    ).toBeNull();
  });

  it('非 JSON 回覆回傳 null', () => {
    expect(engine.extractAdvicePayload({ response: '我覺得下中間' })).toBeNull();
  });

  it('格式毀損的 JSON 回傳 null', () => {
    expect(engine.extractAdvicePayload({ response: '{"threats":[{' })).toBeNull();
  });

  it('完全未知的形狀回傳 null', () => {
    expect(engine.extractAdvicePayload({})).toBeNull();
  });
});

describe('parseAdvice', () => {
  const board = emptyBoard();
  const parse = (o: unknown, b = board) => engine.parseAdvice(o, b);

  it('依嚴重程度給權重', () => {
    const advice = parse({
      threats: [{ row: 7, col: 8, severity: 'critical' }],
      opportunities: [],
      strategy: '守住右側',
    });

    expect(advice.threats).toEqual([{ row: 7, col: 8, weight: 300 }]);
    expect(advice.strategy).toBe('守住右側');
  });

  it('捨棄越界座標', () => {
    expect(
      parse({
        threats: [
          { row: 99, col: 2, severity: 'high' },
          { row: -1, col: 0, severity: 'high' },
        ],
      }).threats
    ).toEqual([]);
  });

  it('捨棄已有棋子的座標', () => {
    const occupied = emptyBoard();
    occupied[5]![5] = 'black';

    expect(
      parse({ threats: [{ row: 5, col: 5, severity: 'critical' }] }, occupied)
        .threats
    ).toEqual([]);
  });

  it('捨棄非整數座標', () => {
    expect(
      parse({ threats: [{ row: 'abc', col: 2, severity: 'high' }] }).threats
    ).toEqual([]);
  });

  it('未知的 severity 退回 medium 權重', () => {
    expect(
      parse({ threats: [{ row: 3, col: 3, severity: 'unknown' }] }).threats
    ).toEqual([{ row: 3, col: 3, weight: 50 }]);
  });

  it('限制每類建議的採納數量', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({
      row: 0,
      col: i,
      severity: 'high',
    }));

    expect(parse({ threats: points }).threats).toHaveLength(4);
  });

  it('去除重複座標', () => {
    expect(
      parse({
        threats: [
          { row: 2, col: 2, severity: 'high' },
          { row: 2, col: 2, severity: 'critical' },
        ],
      }).threats
    ).toHaveLength(1);
  });

  it('null 或非物件回傳空建議', () => {
    expect(parse(null)).toEqual({ threats: [], opportunities: [], strategy: '' });
    expect(parse('字串')).toEqual({
      threats: [],
      opportunities: [],
      strategy: '',
    });
  });
});

describe('模型建議不可蓋過戰術必然手', () => {
  it('擋下必敗的分數仍高於模型指名的無關點', () => {
    const board = emptyBoard();
    // 黑棋四連，(7,7) 是唯一擋點
    for (const col of [3, 4, 5, 6]) board[7]![col] = 'black';
    const s = state(board);

    const blockScore = engine.evaluateMove(s, { row: 7, col: 7 }, 'white');
    const idleScore = engine.evaluateMove(s, { row: 0, col: 0 }, 'white');
    const maxAdviceBonus = 300 + 300; // threats + opportunities 同時命中

    expect(blockScore).toBeGreaterThan(idleScore + maxAdviceBonus);
  });
});

describe('renderBoardWithCoordinates', () => {
  it('輸出含行列編號，讓模型能指出具體座標', () => {
    const board = emptyBoard();
    board[0]![0] = 'black';
    const lines = engine.renderBoardWithCoordinates(board).split('\n');

    expect(lines[0]).toContain('14');
    expect(lines).toHaveLength(16); // 1 行表頭 + 15 列
    expect(lines[1]).toContain('B');
  });
});
