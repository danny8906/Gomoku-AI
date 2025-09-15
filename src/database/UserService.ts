/**
 * 用戶服務 - 處理用戶帳號和戰績
 */

import { Env, User, GameRecord } from '../types';

export class UserService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 創建新用戶
   */
  async createUser(username: string, email?: string, passwordHash?: string): Promise<User> {
    const userId = crypto.randomUUID();
    const now = Date.now();

    const user: User = {
      id: userId,
      username,
      email,
      wins: 0,
      losses: 0,
      draws: 0,
      rating: 1200, // 初始評分
      createdAt: now,
      updatedAt: now
    };

    try {
      await this.env.DB.prepare(`
        INSERT INTO users (id, username, email, password_hash, wins, losses, draws, rating, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `).bind(
        userId,
        username,
        email || null,
        passwordHash || null,
        0, 0, 0,
        1200,
        now, now
      ).run();

      return user;
    } catch (error) {
      console.error('創建用戶失敗:', error);
      throw new Error('用戶名已存在或創建失敗');
    }
  }

  /**
   * 根據 ID 獲取用戶
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM users WHERE id = ?1
      `).bind(userId).first();

      if (!result) return null;

      return {
        id: result.id as string,
        username: result.username as string,
        email: result.email as string | undefined,
        wins: result.wins as number,
        losses: result.losses as number,
        draws: result.draws as number,
        rating: result.rating as number,
        createdAt: result.created_at as number,
        updatedAt: result.updated_at as number
      };
    } catch (error) {
      console.error('獲取用戶失敗:', error);
      return null;
    }
  }

  /**
   * 根據用戶名獲取用戶
   */
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM users WHERE username = ?1
      `).bind(username).first();

      if (!result) return null;

      return {
        id: result.id as string,
        username: result.username as string,
        email: result.email as string | undefined,
        wins: result.wins as number,
        losses: result.losses as number,
        draws: result.draws as number,
        rating: result.rating as number,
        createdAt: result.created_at as number,
        updatedAt: result.updated_at as number
      };
    } catch (error) {
      console.error('根據用戶名獲取用戶失敗:', error);
      return null;
    }
  }

  /**
   * 更新用戶戰績
   */
  async updateUserStats(
    userId: string,
    result: 'win' | 'loss' | 'draw',
    ratingChange: number
  ): Promise<User | null> {
    try {
      const user = await this.getUserById(userId);
      if (!user) return null;

      const newStats = {
        wins: user.wins + (result === 'win' ? 1 : 0),
        losses: user.losses + (result === 'loss' ? 1 : 0),
        draws: user.draws + (result === 'draw' ? 1 : 0),
        rating: user.rating + ratingChange
      };

      await this.env.DB.prepare(`
        UPDATE users 
        SET wins = ?1, losses = ?2, draws = ?3, rating = ?4, updated_at = ?5
        WHERE id = ?6
      `).bind(
        newStats.wins,
        newStats.losses,
        newStats.draws,
        newStats.rating,
        Date.now(),
        userId
      ).run();

      return {
        ...user,
        ...newStats,
        updatedAt: Date.now()
      };
    } catch (error) {
      console.error('更新用戶戰績失敗:', error);
      return null;
    }
  }

  /**
   * 獲取排行榜
   */
  async getLeaderboard(limit: number = 10): Promise<User[]> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT * FROM users 
        ORDER BY rating DESC, wins DESC
        LIMIT ?1
      `).bind(limit).all();

      return results.results.map(result => ({
        id: result.id as string,
        username: result.username as string,
        email: result.email as string | undefined,
        wins: result.wins as number,
        losses: result.losses as number,
        draws: result.draws as number,
        rating: result.rating as number,
        createdAt: result.created_at as number,
        updatedAt: result.updated_at as number
      }));
    } catch (error) {
      console.error('獲取排行榜失敗:', error);
      return [];
    }
  }

  /**
   * 記錄遊戲結果
   */
  async recordGameResult(gameRecord: Omit<GameRecord, 'id' | 'createdAt'>): Promise<GameRecord> {
    const recordId = crypto.randomUUID();
    const now = Date.now();

    const record: GameRecord = {
      ...gameRecord,
      id: recordId,
      createdAt: now
    };

    try {
      await this.env.DB.prepare(`
        INSERT INTO game_records (
          id, game_id, user_id, opponent_id, mode, result, 
          moves, duration, rating, rating_change, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `).bind(
        recordId,
        record.gameId,
        record.userId,
        record.opponentId || null,
        record.mode,
        record.result,
        JSON.stringify(record.moves),
        record.duration,
        record.rating,
        record.ratingChange,
        now
      ).run();

      // 更新用戶戰績
      await this.updateUserStats(record.userId, record.result, record.ratingChange);

      // 如果是 PVP 模式，也更新對手戰績
      if (record.opponentId && record.mode === 'pvp') {
        const opponentResult = record.result === 'win' ? 'loss' : 
                              record.result === 'loss' ? 'win' : 'draw';
        const opponentRatingChange = -record.ratingChange;
        
        await this.updateUserStats(record.opponentId, opponentResult, opponentRatingChange);
        
        // 也為對手創建遊戲記錄
        await this.env.DB.prepare(`
          INSERT INTO game_records (
            id, game_id, user_id, opponent_id, mode, result, 
            moves, duration, rating, rating_change, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        `).bind(
          crypto.randomUUID(),
          record.gameId,
          record.opponentId,
          record.userId,
          record.mode,
          opponentResult,
          JSON.stringify(record.moves),
          record.duration,
          record.rating + record.ratingChange, // 對手的新評分
          opponentRatingChange,
          now
        ).run();
      }

      return record;
    } catch (error) {
      console.error('記錄遊戲結果失敗:', error);
      throw new Error('記錄遊戲結果失敗');
    }
  }

  /**
   * 獲取用戶遊戲歷史
   */
  async getUserGameHistory(userId: string, limit: number = 20): Promise<GameRecord[]> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT * FROM game_records 
        WHERE user_id = ?1 
        ORDER BY created_at DESC 
        LIMIT ?2
      `).bind(userId, limit).all();

      return results.results.map(result => ({
        id: result.id as string,
        gameId: result.game_id as string,
        userId: result.user_id as string,
        opponentId: result.opponent_id as string | undefined,
        mode: result.mode as 'pvp' | 'ai',
        result: result.result as 'win' | 'loss' | 'draw',
        moves: JSON.parse(result.moves as string),
        duration: result.duration as number,
        rating: result.rating as number,
        ratingChange: result.rating_change as number,
        createdAt: result.created_at as number
      }));
    } catch (error) {
      console.error('獲取用戶遊戲歷史失敗:', error);
      return [];
    }
  }

  /**
   * 獲取用戶統計信息
   */
  async getUserStats(userId: string): Promise<{
    totalGames: number;
    winRate: number;
    averageGameDuration: number;
    ratingHistory: { date: number; rating: number }[];
  }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return {
          totalGames: 0,
          winRate: 0,
          averageGameDuration: 0,
          ratingHistory: []
        };
      }

      const totalGames = user.wins + user.losses + user.draws;
      const winRate = totalGames > 0 ? user.wins / totalGames : 0;

      // 獲取平均遊戲時長
      const durationResult = await this.env.DB.prepare(`
        SELECT AVG(duration) as avg_duration FROM game_records WHERE user_id = ?1
      `).bind(userId).first();

      const averageGameDuration = durationResult?.avg_duration as number || 0;

      // 獲取評分歷史（最近 10 場）
      const ratingHistory = await this.env.DB.prepare(`
        SELECT rating, created_at FROM game_records 
        WHERE user_id = ?1 
        ORDER BY created_at DESC 
        LIMIT 10
      `).bind(userId).all();

      return {
        totalGames,
        winRate,
        averageGameDuration,
        ratingHistory: ratingHistory.results.map(r => ({
          date: r.created_at as number,
          rating: r.rating as number
        })).reverse()
      };
    } catch (error) {
      console.error('獲取用戶統計信息失敗:', error);
      return {
        totalGames: 0,
        winRate: 0,
        averageGameDuration: 0,
        ratingHistory: []
      };
    }
  }

  /**
   * 計算評分變化（ELO 系統）
   */
  calculateRatingChange(
    playerRating: number,
    opponentRating: number,
    result: 'win' | 'loss' | 'draw',
    kFactor: number = 32
  ): number {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    
    let actualScore: number;
    switch (result) {
      case 'win':
        actualScore = 1;
        break;
      case 'loss':
        actualScore = 0;
        break;
      case 'draw':
        actualScore = 0.5;
        break;
    }

    return Math.round(kFactor * (actualScore - expectedScore));
  }

  /**
   * 搜索用戶
   */
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT * FROM users 
        WHERE username LIKE ?1 
        ORDER BY rating DESC 
        LIMIT ?2
      `).bind(`%${query}%`, limit).all();

      return results.results.map(result => ({
        id: result.id as string,
        username: result.username as string,
        email: result.email as string | undefined,
        wins: result.wins as number,
        losses: result.losses as number,
        draws: result.draws as number,
        rating: result.rating as number,
        createdAt: result.created_at as number,
        updatedAt: result.updated_at as number
      }));
    } catch (error) {
      console.error('搜索用戶失敗:', error);
      return [];
    }
  }
}
