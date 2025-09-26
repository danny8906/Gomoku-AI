/**
 * 遊戲記錄保存功能
 */

import { Env, GameState } from '../types';

/**
 * 保存 AI 對戰遊戲記錄
 */
export async function saveAIGameRecord(
  gameState: GameState,
  env: Env
): Promise<void> {
  try {
    const playerId = gameState.players.black; // AI 模式下玩家總是黑棋
    if (!playerId) return;

    console.log('保存 AI 對戰記錄:', gameState.id);

    // 確保用戶存在
    await ensureUserExists(playerId, env);

    const gameDuration = gameState.updatedAt - gameState.createdAt;

    // 確定遊戲結果
    let result: 'win' | 'loss' | 'draw';
    if (gameState.winner === 'draw') {
      result = 'draw';
    } else if (gameState.winner === 'black') {
      result = 'win'; // 玩家是黑棋，獲勝
    } else {
      result = 'loss'; // AI (白棋) 獲勝
    }

    // 獲取玩家當前評分
    const userResult = await env.DB.prepare(
      `
      SELECT rating FROM users WHERE id = ?1
    `
    )
      .bind(playerId)
      .first();

    const currentRating = (userResult?.rating as number) || 1200;

    // 計算評分變化
    let ratingChange = 0;
    if (result === 'win') {
      ratingChange = 20; // 戰勝 AI 獲得評分
    } else if (result === 'loss') {
      ratingChange = -10; // 敗給 AI 扣除評分
    }

    // 保存遊戲記錄
    await env.DB.prepare(
      `
      INSERT INTO game_records (
        id, game_id, user_id, opponent_id, mode, result, 
        moves, duration, rating, rating_change, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `
    )
      .bind(
        crypto.randomUUID(),
        gameState.id,
        playerId,
        null, // AI 對戰沒有對手 ID
        'ai',
        result,
        JSON.stringify(gameState.moves),
        gameDuration,
        currentRating,
        ratingChange,
        Date.now()
      )
      .run();

    // 更新用戶戰績
    const updateQuery =
      result === 'win'
        ? `UPDATE users SET wins = wins + 1, rating = rating + ?1, updated_at = ?2 WHERE id = ?3`
        : result === 'loss'
          ? `UPDATE users SET losses = losses + 1, rating = rating + ?1, updated_at = ?2 WHERE id = ?3`
          : `UPDATE users SET draws = draws + 1, updated_at = ?2 WHERE id = ?3`;

    if (result === 'draw') {
      await env.DB.prepare(updateQuery).bind(Date.now(), playerId).run();
    } else {
      await env.DB.prepare(updateQuery)
        .bind(ratingChange, Date.now(), playerId)
        .run();
    }

    console.log(
      `AI 對戰記錄已保存: 玩家 ${playerId}, 結果 ${result}, 評分變化 ${ratingChange}`
    );
  } catch (error) {
    console.error('保存 AI 對戰記錄失敗:', error);
  }
}

/**
 * 確保用戶存在，如果不存在則創建
 */
async function ensureUserExists(userId: string, env: Env): Promise<void> {
  const userExists = await env.DB.prepare(
    `
    SELECT id FROM users WHERE id = ?1
  `
  )
    .bind(userId)
    .first();

  if (!userExists) {
    console.log(`用戶 ${userId} 不存在，正在創建...`);
    await env.DB.prepare(
      `
      INSERT INTO users (id, username, wins, losses, draws, rating, created_at, updated_at)
      VALUES (?1, ?2, 0, 0, 0, 1200, ?3, ?4)
    `
    )
      .bind(
        userId,
        `匿名玩家_${userId.slice(-6)}`,
        Date.now(),
        Date.now()
      )
      .run();
    console.log(`已創建用戶: ${userId}`);
  }
}
