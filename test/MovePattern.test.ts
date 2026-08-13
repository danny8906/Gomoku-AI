import { describe, it, expect } from 'vitest';
import {
  canonicalPattern,
  toCanonicalOffset,
  fromCanonicalOffset,
  isRecordableOffset,
  TRANSFORMS,
  PATTERN_RADIUS,
} from '../src/game/MovePattern';
import type { Player, Position } from '../src/types';

function emptyBoard(): Player[][] {
  return Array(15)
    .fill(null)
    .map(() => Array(15).fill(null));
}

type Cell = [number, number, Player];

function boardOf(cells: Cell[]): Player[][] {
  const board = emptyBoard();
  for (const [r, c, v] of cells) board[r]![c] = v;
  return board;
}

/** 把整個盤面繞中心旋轉 90 度（row,col) -> (col, 14-row) */
function rotate90(board: Player[][]): Player[][] {
  const out = emptyBoard();
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      out[c]![14 - r] = board[r]![c]!;
    }
  }
  return out;
}

function rotatePoint(p: Position): Position {
  return { row: p.col, col: 14 - p.row };
}

describe('對稱轉換', () => {
  it('每個轉換的 invert 都是自身的反函數', () => {
    for (const t of TRANSFORMS) {
      for (const [r, c] of [
        [1, 2],
        [-3, 0],
        [0, -2],
        [3, -3],
      ]) {
        const [ar, ac] = t.apply(r!, c!);
        const [br, bc] = t.invert(ar, ac);
        expect([br, bc], `${t.name} 對 (${r},${c})`).toEqual([r, c]);
      }
    }
  });

  it('提供完整的八個對稱且互不重複', () => {
    expect(TRANSFORMS).toHaveLength(8);

    const signatures = TRANSFORMS.map(t =>
      [
        t.apply(1, 0).join(','),
        t.apply(0, 1).join(','),
      ].join('|')
    );

    expect(new Set(signatures).size).toBe(8);
  });
});

describe('canonicalPattern', () => {
  const centre: Position = { row: 7, col: 7 };

  it('鍵的長度等於視窗格數', () => {
    const size = PATTERN_RADIUS * 2 + 1;
    expect(canonicalPattern(emptyBoard(), centre, 'black').key).toHaveLength(
      size * size
    );
  });

  it('旋轉整個盤面後得到相同的鍵', () => {
    const board = boardOf([
      [7, 5, 'black'],
      [7, 6, 'black'],
      [6, 6, 'white'],
      [8, 8, 'white'],
    ]);

    const a = canonicalPattern(board, centre, 'black').key;
    const b = canonicalPattern(rotate90(board), rotatePoint(centre), 'black').key;

    expect(b).toBe(a);
  });

  it('黑白互換但棋型相同時得到相同的鍵', () => {
    const asBlack = boardOf([
      [7, 5, 'black'],
      [7, 6, 'black'],
      [6, 6, 'white'],
    ]);
    const asWhite = boardOf([
      [7, 5, 'white'],
      [7, 6, 'white'],
      [6, 6, 'black'],
    ]);

    // 編碼是相對於「輪到誰下」，因此雙方顏色整組互換後應一致
    expect(canonicalPattern(asWhite, centre, 'white').key).toBe(
      canonicalPattern(asBlack, centre, 'black').key
    );
  });

  it('不同的棋型得到不同的鍵', () => {
    const a = canonicalPattern(
      boardOf([
        [7, 5, 'black'],
        [7, 6, 'black'],
      ]),
      centre,
      'black'
    ).key;

    const b = canonicalPattern(
      boardOf([
        [5, 5, 'black'],
        [6, 6, 'black'],
      ]),
      centre,
      'black'
    ).key;

    expect(a).not.toBe(b);
  });

  it('靠近邊界時以 # 標示界外', () => {
    const key = canonicalPattern(emptyBoard(), { row: 0, col: 0 }, 'black').key;
    expect(key).toContain('#');
  });

  it('中心點的棋子會被納入編碼', () => {
    const withStone = canonicalPattern(
      boardOf([[7, 7, 'white']]),
      centre,
      'black'
    ).key;

    expect(withStone).not.toBe(
      canonicalPattern(emptyBoard(), centre, 'black').key
    );
  });
});

describe('位移的正規化換算', () => {
  it('轉入再轉回會得到原本的位移', () => {
    for (let i = 0; i < TRANSFORMS.length; i++) {
      for (const offset of [
        { dr: 1, dc: 0 },
        { dr: -2, dc: 3 },
        { dr: 0, dc: -4 },
      ]) {
        expect(fromCanonicalOffset(toCanonicalOffset(offset, i), i)).toEqual(
          offset
        );
      }
    }
  });

  it('旋轉盤面後，換算回來的建議會落在對應的位置', () => {
    const board = boardOf([
      [7, 5, 'black'],
      [7, 6, 'black'],
      [6, 6, 'white'],
    ]);
    const centre: Position = { row: 7, col: 7 };
    const nextMove: Position = { row: 7, col: 8 };
    const offset = {
      dr: nextMove.row - centre.row,
      dc: nextMove.col - centre.col,
    };

    // 在原盤面上記錄
    const origin = canonicalPattern(board, centre, 'black');
    const canonical = toCanonicalOffset(offset, origin.transformIndex);

    // 在旋轉後的盤面上查詢，應還原成旋轉後的對應點
    const rotatedCentre = rotatePoint(centre);
    const rotated = canonicalPattern(rotate90(board), rotatedCentre, 'black');
    expect(rotated.key).toBe(origin.key);

    const back = fromCanonicalOffset(canonical, rotated.transformIndex);
    const resolved = {
      row: rotatedCentre.row + back.dr,
      col: rotatedCentre.col + back.dc,
    };

    expect(resolved).toEqual(rotatePoint(nextMove));
  });
});

describe('isRecordableOffset', () => {
  it('鄰近的後續手可記錄', () => {
    expect(isRecordableOffset({ dr: 0, dc: 1 })).toBe(true);
    expect(isRecordableOffset({ dr: -6, dc: 6 })).toBe(true);
  });

  it('過遠的後續手不記錄', () => {
    expect(isRecordableOffset({ dr: 7, dc: 0 })).toBe(false);
    expect(isRecordableOffset({ dr: 0, dc: -9 })).toBe(false);
  });
});
