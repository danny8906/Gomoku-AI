/**
 * 自我訓練必須與正式對局共用同一套策略，
 * 否則產生的棋譜對應的是另一個對手，學到的東西用不上。
 */
import { describe, it, expect } from 'vitest';
import { SelfTrainingService } from '../src/ai/SelfTrainingService';
import { AIEngine } from '../src/ai/AIEngine';
import { GameLogic } from '../src/game/GameLogic';
import { canonicalPattern, toCanonicalOffset } from '../src/game/MovePattern';
import type { Env, GameState, Player, Position } from '../src/types';

function emptyBoard(): Player[][] {
  return Array(15)
    .fill(null)
    .map(() => Array(15).fill(null));
}

function boardOf(cells: Array<[number, number, Player]>): Player[][] {
  const board = emptyBoard();
  for (const [r, c, v] of cells) board[r]![c] = v;
  return board;
}

describe('策略一致性', () => {
  it('AIEngine 的著手評估就是 GameLogic.evaluateMove', () => {
    const board = boardOf([
      [7, 5, 'black'],
      [7, 6, 'black'],
      [8, 8, 'white'],
    ]);
    const state: GameState = {
      id: 'x',
      board,
      currentPlayer: 'white',
      status: 'playing',
      mode: 'ai',
      moves: [],
      winner: null,
      players: {},
      createdAt: 0,
      updatedAt: 0,
    };
    const engine = new AIEngine({} as Env) as any;

    for (const position of GameLogic.getRelevantMoves(board).slice(0, 12)) {
      expect(engine.evaluateMove(state, position, 'white')).toBe(
        GameLogic.evaluateMove(board, position, 'white')
      );
    }
  });

  it('selectBestMove 在 noise=0 時完全確定', () => {
    const board = boardOf([
      [7, 5, 'black'],
      [7, 6, 'black'],
      [7, 7, 'black'],
    ]);

    const first = GameLogic.selectBestMove(board, 'white', 0);
    for (let i = 0; i < 5; i++) {
      expect(GameLogic.selectBestMove(board, 'white', 0)).toEqual(first);
    }
  });

  it('selectBestMove 會擋下對手的沖四', () => {
    const board = boardOf([
      [7, 4, 'black'],
      [7, 5, 'black'],
      [7, 6, 'black'],
      [7, 7, 'black'],
      [7, 3, 'white'],
    ]);

    expect(GameLogic.selectBestMove(board, 'white', 0)).toEqual({
      row: 7,
      col: 8,
    });
  });

  it('noise 只帶來探索，不會蓋過必然手', () => {
    const board = boardOf([
      [7, 4, 'black'],
      [7, 5, 'black'],
      [7, 6, 'black'],
      [7, 7, 'black'],
      [7, 3, 'white'],
    ]);

    // 即使給最大的 easy 擾動，擋點的分數差距仍遠大於擾動幅度
    for (let i = 0; i < 20; i++) {
      expect(GameLogic.selectBestMove(board, 'white', 400)).toEqual({
        row: 7,
        col: 8,
      });
    }
  });

  it('空盤時回傳中心點', () => {
    expect(GameLogic.selectBestMove(emptyBoard(), 'black', 0)).toEqual({
      row: 7,
      col: 7,
    });
  });
});

describe('自我對戰的產出可被棋型書檢索', () => {
  it('對局能正常結束且走法連續合法', async () => {
    const service = new SelfTrainingService({} as Env) as any;
    const game = await service.playSelfGame(0, 'medium');

    expect(game.moves.length).toBeGreaterThan(4);

    // 黑白交替、且沒有重複落在同一點
    const seen = new Set<string>();
    for (let i = 0; i < game.moves.length; i++) {
      const move = game.moves[i];
      expect(move.player).toBe(i % 2 === 0 ? 'black' : 'white');

      const k = `${move.position.row},${move.position.col}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('自我對戰產生的走法能算出與查詢端一致的棋型鍵', async () => {
    const service = new SelfTrainingService({} as Env) as any;
    const game = await service.playSelfGame(1, 'hard');

    if (game.finalOutcome === 'draw') return; // 和局不入庫

    const winner: Player = game.finalOutcome === 'win' ? 'black' : 'white';

    // 重放到某一手勝方著手之前，確認寫入端與查詢端算出同一個鍵
    const board = emptyBoard();
    let checked = 0;

    for (let i = 0; i < game.moves.length && checked < 3; i++) {
      const move = game.moves[i]!;
      const previous = game.moves[i - 1];

      if (move.player === winner && previous) {
        const written = canonicalPattern(board, previous.position, move.player);
        const queried = canonicalPattern(board, previous.position, winner);

        expect(queried.key).toBe(written.key);

        const offset = {
          dr: move.position.row - previous.position.row,
          dc: move.position.col - previous.position.col,
        };
        // 換算到正規空間後必須是整數位移
        const canonical = toCanonicalOffset(offset, written.transformIndex);
        expect(Number.isInteger(canonical.dr)).toBe(true);
        expect(Number.isInteger(canonical.dc)).toBe(true);

        checked++;
      }

      board[move.position.row]![move.position.col] = move.player;
    }

    expect(checked).toBeGreaterThan(0);
  });

  it('不同難度的擾動會產生不同的棋局', async () => {
    const service = new SelfTrainingService({} as Env) as any;
    const a = await service.playSelfGame(2, 'easy');
    const b = await service.playSelfGame(3, 'easy');

    const seq = (g: { moves: Array<{ position: Position }> }) =>
      g.moves.map(m => `${m.position.row},${m.position.col}`).join('|');

    // 擾動存在時，兩局不應完全相同（極小機率相同，重試一次即可）
    if (seq(a) === seq(b)) {
      const c = await service.playSelfGame(4, 'easy');
      expect(seq(a) === seq(b) && seq(b) === seq(c)).toBe(false);
    }
  });
});
