/**
 * 棋型書（pattern book）
 *
 * 以局部棋型為索引鍵，記錄「勝方在這個棋型下走了哪一手」，
 * 供 AI 在遇到相同棋型時參考。查詢只是一次帶索引的 D1 查詢，
 * 不需要任何模型推論。
 */

import { Env, GameState, Player, Position } from '../types';
import { GameLogic } from '../game/GameLogic';
import {
  canonicalPattern,
  fromCanonicalOffset,
  isRecordableOffset,
  toCanonicalOffset,
} from '../game/MovePattern';

/** 一次查詢最多採納幾個建議 */
const MAX_SUGGESTIONS = 3;

/** 單場對局最多記錄幾筆，避免長局灌爆資料表 */
const MAX_ROWS_PER_GAME = 60;

export class PatternService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 從已結束的對局擷取棋型
   *
   * 只記錄勝方的走法：這份資料是要拿來當「這個局面該怎麼下」的參考，
   * 敗方的走法沒有參考價值，和局則兩邊都不記。
   */
  async recordGame(gameState: GameState): Promise<number> {
    const winner = gameState.winner;

    if (!winner || winner === 'draw' || gameState.moves.length < 2) {
      return 0;
    }

    const statements = [];
    const now = Date.now();

    // 重放棋局，逐手重建當時的盤面
    const board: Player[][] = Array(GameLogic.BOARD_SIZE)
      .fill(null)
      .map(() => Array(GameLogic.BOARD_SIZE).fill(null));

    for (let i = 0; i < gameState.moves.length; i++) {
      const move = gameState.moves[i]!;
      const previous = i > 0 ? gameState.moves[i - 1] : undefined;

      // 只取勝方的走法，且必須有前一手可以當作視窗中心
      if (move.player === winner && previous) {
        const offset = {
          dr: move.position.row - previous.position.row,
          dc: move.position.col - previous.position.col,
        };

        if (isRecordableOffset(offset)) {
          const { key, transformIndex } = canonicalPattern(
            board,
            previous.position,
            move.player
          );
          const canonical = toCanonicalOffset(offset, transformIndex);

          statements.push(
            this.env.DB.prepare(
              `INSERT INTO move_patterns (pattern_key, next_dr, next_dc, game_id, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5)`
            ).bind(key, canonical.dr, canonical.dc, gameState.id, now)
          );
        }
      }

      board[move.position.row]![move.position.col] = move.player;

      if (statements.length >= MAX_ROWS_PER_GAME) break;
    }

    if (statements.length === 0) return 0;

    try {
      await this.env.DB.batch(statements);
      console.log(
        `[Pattern] 已記錄 ${statements.length} 筆棋型: ${gameState.id}`
      );
      return statements.length;
    } catch (error) {
      console.error('[Pattern] 記錄棋型失敗:', error);
      return 0;
    }
  }

  /**
   * 依目前局面查出歷史上最常見的後續手
   */
  async suggest(gameState: GameState): Promise<{
    suggestions: Position[];
    reasoning: string[];
  }> {
    const lastMove = gameState.moves[gameState.moves.length - 1];
    const mover = gameState.currentPlayer;

    if (!lastMove || !mover) {
      return { suggestions: [], reasoning: ['尚無可比對的棋型'] };
    }

    const startTime = Date.now();

    try {
      const { key, transformIndex } = canonicalPattern(
        gameState.board,
        lastMove.position,
        mover
      );

      const rows = await this.env.DB.prepare(
        `SELECT next_dr, next_dc, COUNT(*) AS freq
           FROM move_patterns
          WHERE pattern_key = ?1
          GROUP BY next_dr, next_dc
          ORDER BY freq DESC
          LIMIT ?2`
      )
        .bind(key, MAX_SUGGESTIONS)
        .all();

      const suggestions: Position[] = [];
      const frequencies: number[] = [];

      for (const row of rows.results) {
        const offset = fromCanonicalOffset(
          { dr: row.next_dr as number, dc: row.next_dc as number },
          transformIndex
        );

        const position = {
          row: lastMove.position.row + offset.dr,
          col: lastMove.position.col + offset.dc,
        };

        // 歷史棋譜的建議仍須符合目前盤面
        if (
          GameLogic.isValidPosition(position) &&
          GameLogic.isEmptyPosition(gameState.board, position)
        ) {
          suggestions.push(position);
          frequencies.push(row.freq as number);
        }
      }

      console.log(
        `[Pattern] 查詢完成 - 耗時: ${Date.now() - startTime}ms, 命中: ${suggestions.length}`
      );

      return {
        suggestions,
        reasoning:
          suggestions.length > 0
            ? [`比對到相同棋型，歷史採用次數: ${frequencies.join(', ')}`]
            : ['沒有比對到相同的歷史棋型'],
      };
    } catch (error) {
      console.error('[Pattern] 查詢棋型失敗:', error);
      return { suggestions: [], reasoning: ['查詢棋型時發生錯誤'] };
    }
  }
}
