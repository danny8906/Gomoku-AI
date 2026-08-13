/**
 * 局部棋型索引
 *
 * 取代原本「把棋盤敘述成一段文字再做 embedding」的檢索方式。
 * 實測那個做法完全無法分辨盤面：幾乎相同的兩個盤面餘弦相似度 0.9921，
 * 而完全不同的盤面也有 0.9728~0.9892，差距只有千分之三到百分之二，
 * 在 0.7 的門檻下等於全部命中，檢索結果形同隨機。
 *
 * 這裡改用確定性的做法：取最後一手周邊的局部棋型，
 * 以顏色無關的編碼加上八種對稱正規化後當成索引鍵，直接做精確比對。
 * 不需要任何模型推論。
 */

import { Player, Position } from '../types';
import { GameLogic } from './GameLogic';

/** 局部視窗半徑；7x7 在泛化與鑑別力之間取平衡 */
export const PATTERN_RADIUS = 3;

/** 只記錄鄰近的後續手，太遠的關聯性低 */
export const MAX_NEXT_OFFSET = 6;

type OffsetFn = (dr: number, dc: number) => [number, number];

interface Transform {
  name: string;
  apply: OffsetFn;
  invert: OffsetFn;
}

/**
 * 正方形的八個對稱（二面體群 D4）
 *
 * 經過正規化後，同一個棋型的八種旋轉鏡像會共用同一個索引鍵，
 * 少量棋譜也能被有效重複利用。
 */
export const TRANSFORMS: Transform[] = [
  { name: 'identity', apply: (r, c) => [r, c], invert: (r, c) => [r, c] },
  { name: 'rot90', apply: (r, c) => [c, -r], invert: (r, c) => [-c, r] },
  { name: 'rot180', apply: (r, c) => [-r, -c], invert: (r, c) => [-r, -c] },
  { name: 'rot270', apply: (r, c) => [-c, r], invert: (r, c) => [c, -r] },
  { name: 'flipRow', apply: (r, c) => [-r, c], invert: (r, c) => [-r, c] },
  { name: 'flipCol', apply: (r, c) => [r, -c], invert: (r, c) => [r, -c] },
  { name: 'transpose', apply: (r, c) => [c, r], invert: (r, c) => [c, r] },
  { name: 'antiTranspose', apply: (r, c) => [-c, -r], invert: (r, c) => [-c, -r] },
];

/**
 * 以某個對稱序列化局部視窗
 *
 * 編碼相對於「輪到誰下」：M 是即將落子的一方、O 是對手，
 * 因此黑白互換的相同局面會得到相同的鍵。
 */
function serialize(
  board: Player[][],
  centre: Position,
  mover: Player,
  transform: Transform
): string {
  const cells: string[] = [];

  for (let dr = -PATTERN_RADIUS; dr <= PATTERN_RADIUS; dr++) {
    for (let dc = -PATTERN_RADIUS; dc <= PATTERN_RADIUS; dc++) {
      // 反向轉換：目標格 (dr,dc) 的內容來自原盤面的哪一格
      const [sr, sc] = transform.invert(dr, dc);
      const row = centre.row + sr;
      const col = centre.col + sc;

      if (
        row < 0 ||
        row >= GameLogic.BOARD_SIZE ||
        col < 0 ||
        col >= GameLogic.BOARD_SIZE
      ) {
        cells.push('#'); // 界外
        continue;
      }

      const cell = board[row]?.[col] ?? null;
      cells.push(cell === null ? '.' : cell === mover ? 'M' : 'O');
    }
  }

  return cells.join('');
}

export interface CanonicalPattern {
  /** 正規化後的索引鍵 */
  key: string;
  /** 產生此鍵所用的對稱編號，用來換算後續手的座標 */
  transformIndex: number;
}

/**
 * 求出局部棋型的正規形式：取八個對稱中字典序最小者
 */
export function canonicalPattern(
  board: Player[][],
  centre: Position,
  mover: Player
): CanonicalPattern {
  let key = '';
  let transformIndex = 0;

  for (let i = 0; i < TRANSFORMS.length; i++) {
    const candidate = serialize(board, centre, mover, TRANSFORMS[i]!);
    if (i === 0 || candidate < key) {
      key = candidate;
      transformIndex = i;
    }
  }

  return { key, transformIndex };
}

/** 把盤面上的位移換算成正規空間的位移 */
export function toCanonicalOffset(
  offset: { dr: number; dc: number },
  transformIndex: number
): { dr: number; dc: number } {
  const [dr, dc] = TRANSFORMS[transformIndex]!.apply(offset.dr, offset.dc);
  return { dr, dc };
}

/** 把正規空間的位移換算回盤面上的位移 */
export function fromCanonicalOffset(
  offset: { dr: number; dc: number },
  transformIndex: number
): { dr: number; dc: number } {
  const [dr, dc] = TRANSFORMS[transformIndex]!.invert(offset.dr, offset.dc);
  return { dr, dc };
}

/** 後續手是否落在值得記錄的範圍內 */
export function isRecordableOffset(offset: {
  dr: number;
  dc: number;
}): boolean {
  return (
    Math.abs(offset.dr) <= MAX_NEXT_OFFSET &&
    Math.abs(offset.dc) <= MAX_NEXT_OFFSET
  );
}
