import { describe, it, expect } from 'vitest';
import { GameLogic } from '../src/game/GameLogic';
import type { GameState, Player, Position } from '../src/types';

function emptyBoard(): Player[][] {
  return Array(GameLogic.BOARD_SIZE)
    .fill(null)
    .map(() => Array(GameLogic.BOARD_SIZE).fill(null));
}

function playing(board: Player[][], currentPlayer: Player = 'black'): GameState {
  return {
    id: 'test-game',
    board,
    currentPlayer,
    status: 'playing',
    mode: 'ai',
    moves: [],
    winner: null,
    players: { black: 'p1' },
    createdAt: 0,
    updatedAt: 0,
  };
}

function place(board: Player[][], player: Player, cells: Position[]): void {
  for (const { row, col } of cells) {
    board[row]![col] = player;
  }
}

describe('checkWinner', () => {
  it('偵測水平五連', () => {
    const board = emptyBoard();
    place(board, 'black', [
      { row: 7, col: 3 },
      { row: 7, col: 4 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },
      { row: 7, col: 7 },
    ]);

    expect(GameLogic.checkWinner(board, { row: 7, col: 7 }, 'black')).toBe('black');
  });

  it('偵測對角線五連', () => {
    const board = emptyBoard();
    place(board, 'white', [
      { row: 2, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 4 },
      { row: 5, col: 5 },
      { row: 6, col: 6 },
    ]);

    expect(GameLogic.checkWinner(board, { row: 4, col: 4 }, 'white')).toBe('white');
  });

  it('四連不算獲勝', () => {
    const board = emptyBoard();
    place(board, 'black', [
      { row: 7, col: 3 },
      { row: 7, col: 4 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },
    ]);

    expect(GameLogic.checkWinner(board, { row: 7, col: 6 }, 'black')).toBeNull();
  });

  it('被對手擋住的連線不算獲勝', () => {
    const board = emptyBoard();
    place(board, 'black', [
      { row: 7, col: 3 },
      { row: 7, col: 4 },
      { row: 7, col: 6 },
      { row: 7, col: 7 },
    ]);
    place(board, 'white', [{ row: 7, col: 5 }]);

    expect(GameLogic.checkWinner(board, { row: 7, col: 4 }, 'black')).toBeNull();
  });
});

describe('makeMove', () => {
  it('拒絕不是該玩家的回合', () => {
    expect(() =>
      GameLogic.makeMove(playing(emptyBoard(), 'black'), { row: 7, col: 7 }, 'white')
    ).toThrow('不是該玩家的回合');
  });

  it('拒絕已有棋子的位置', () => {
    const board = emptyBoard();
    place(board, 'black', [{ row: 7, col: 7 }]);

    expect(() =>
      GameLogic.makeMove(playing(board, 'white'), { row: 7, col: 7 }, 'white')
    ).toThrow('該位置已有棋子');
  });

  it('拒絕棋盤外的位置', () => {
    expect(() =>
      GameLogic.makeMove(playing(emptyBoard()), { row: 15, col: 0 }, 'black')
    ).toThrow('無效的位置');
  });

  it('落子後換手且不修改原本的棋盤', () => {
    const board = emptyBoard();
    const state = playing(board, 'black');
    const next = GameLogic.makeMove(state, { row: 7, col: 7 }, 'black');

    expect(next.currentPlayer).toBe('white');
    expect(next.board[7]![7]).toBe('black');
    expect(board[7]![7]).toBeNull();
  });

  it('連成五子即結束並記錄勝者', () => {
    const board = emptyBoard();
    place(board, 'black', [
      { row: 7, col: 3 },
      { row: 7, col: 4 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },
    ]);

    const next = GameLogic.makeMove(playing(board, 'black'), { row: 7, col: 7 }, 'black');

    expect(next.status).toBe('finished');
    expect(next.winner).toBe('black');
  });
});

describe('shouldDeclareDraw', () => {
  it('未下滿棋盤不判和', () => {
    // 224 手時仍有一格可下，不應提前判和
    expect(GameLogic.shouldDeclareDraw(Array(224).fill({}) as never)).toBe(false);
  });

  it('下滿 225 手才判和', () => {
    expect(GameLogic.shouldDeclareDraw(Array(225).fill({}) as never)).toBe(true);
  });
});

describe('evaluatePosition', () => {
  it('活四的分數高於活三', () => {
    const three = emptyBoard();
    place(three, 'black', [
      { row: 7, col: 4 },
      { row: 7, col: 5 },
    ]);

    const four = emptyBoard();
    place(four, 'black', [
      { row: 7, col: 4 },
      { row: 7, col: 5 },
      { row: 7, col: 3 },
    ]);

    const threeScore = GameLogic.evaluatePosition(three, { row: 7, col: 6 }, 'black');
    const fourScore = GameLogic.evaluatePosition(four, { row: 7, col: 6 }, 'black');

    expect(fourScore).toBeGreaterThan(threeScore);
  });

  it('每個方向的棋型只計一次分，不會活三疊加眠三', () => {
    const board = emptyBoard();
    place(board, 'black', [
      { row: 7, col: 5 },
      { row: 7, col: 6 },
    ]);

    // 單一方向的活三固定為 1000，不應因重複比對而變成 1100
    const score = GameLogic.evaluatePosition(board, { row: 7, col: 7 }, 'black');

    expect(score).toBe(1000);
  });
});

describe('getRelevantMoves', () => {
  it('空棋盤回傳中心點', () => {
    expect(GameLogic.getRelevantMoves(emptyBoard())).toEqual([{ row: 7, col: 7 }]);
  });

  it('只回傳已有棋子附近的空位', () => {
    const board = emptyBoard();
    place(board, 'black', [{ row: 7, col: 7 }]);

    const moves = GameLogic.getRelevantMoves(board, 1);

    expect(moves).toHaveLength(8);
    expect(moves).not.toContainEqual({ row: 7, col: 7 });
    expect(moves).toContainEqual({ row: 6, col: 6 });
  });
});
