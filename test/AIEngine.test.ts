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

describe('extractText', () => {
  it('llama 形狀：response 是字串', () => {
    expect(engine.extractText({ response: '黑棋形成活三' })).toBe('黑棋形成活三');
  });

  it('OpenAI 形狀：choices[0].message.content', () => {
    expect(
      engine.extractText({ choices: [{ message: { content: '白棋需要防守' } }] })
    ).toBe('白棋需要防守');
  });

  it('推理模型的 content 為 null 時回傳空字串而非拋錯', () => {
    expect(
      engine.extractText({ choices: [{ message: { content: null } }] })
    ).toBe('');
  });

  it('llama 回傳物件（非字串）時不誤用', () => {
    expect(engine.extractText({ response: { threats: [] } })).toBe('');
  });

  it('完全未知的形狀回傳空字串', () => {
    expect(engine.extractText({})).toBe('');
  });
});

describe('戰術評分量級', () => {
  it('擋下必敗的分數遠高於無關點', () => {
    const board = emptyBoard();
    // 黑棋四連，(7,7) 是唯一擋點
    for (const col of [3, 4, 5, 6]) board[7]![col] = 'black';
    const s = state(board);

    const blockScore = engine.evaluateMove(s, { row: 7, col: 7 }, 'white');
    const idleScore = engine.evaluateMove(s, { row: 0, col: 0 }, 'white');
    // 歷史建議 200 與優劣勢加分 300 都不可能翻轉這個差距
    expect(blockScore).toBeGreaterThan(idleScore + 500);
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
