/**
 * 房間服務 - 處理房間狀態管理和批量操作
 */

import { Env } from '../types';

export class RoomService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 獲取所有活躍房間
   */
  async getActiveRooms(): Promise<Array<{
    roomCode: string;
    gameId: string;
    status: 'waiting' | 'playing' | 'finished';
    playerCount: number;
    lastActivity: number;
    createdAt: number;
  }>> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT r.code, r.game_id, r.status, r.created_at,
               g.black_player_id, g.white_player_id, g.updated_at
        FROM rooms r
        JOIN games g ON r.game_id = g.id
        WHERE r.status IN ('waiting', 'playing')
        ORDER BY g.updated_at DESC
      `).all();

      return results.results.map(result => ({
        roomCode: result.code as string,
        gameId: result.game_id as string,
        status: result.status as 'waiting' | 'playing' | 'finished',
        playerCount: (result.black_player_id ? 1 : 0) + (result.white_player_id ? 1 : 0),
        lastActivity: result.updated_at as number,
        createdAt: result.created_at as number
      }));
    } catch (error) {
      console.error('獲取活躍房間失敗:', error);
      return [];
    }
  }

  /**
   * 獲取閒置房間（超過指定時間無活動）
   */
  async getIdleRooms(inactiveMinutes: number = 30): Promise<Array<{
    roomCode: string;
    gameId: string;
    lastActivity: number;
    inactiveMinutes: number;
  }>> {
    try {
      const cutoffTime = Date.now() - (inactiveMinutes * 60 * 1000);
      
      const results = await this.env.DB.prepare(`
        SELECT r.code, r.game_id, g.updated_at
        FROM rooms r
        JOIN games g ON r.game_id = g.id
        WHERE r.status IN ('waiting', 'playing')
        AND g.updated_at < ?1
        ORDER BY g.updated_at ASC
      `).bind(cutoffTime).all();

      return results.results.map(result => ({
        roomCode: result.code as string,
        gameId: result.game_id as string,
        lastActivity: result.updated_at as number,
        inactiveMinutes: Math.floor((Date.now() - result.updated_at) / (60 * 1000))
      }));
    } catch (error) {
      console.error('獲取閒置房間失敗:', error);
      return [];
    }
  }

  /**
   * 批量更新房間狀態
   */
  async updateRoomStatuses(
    roomCodes: string[], 
    status: 'waiting' | 'playing' | 'finished'
  ): Promise<number> {
    if (roomCodes.length === 0) return 0;

    try {
      const placeholders = roomCodes.map(() => '?').join(',');
      
      const result = await this.env.DB.prepare(`
        UPDATE rooms 
        SET status = ?1 
        WHERE code IN (${placeholders})
      `).bind(status, ...roomCodes).run();

      console.log(`已更新 ${result.changes} 個房間狀態為: ${status}`);
      return result.changes;
    } catch (error) {
      console.error('批量更新房間狀態失敗:', error);
      return 0;
    }
  }

  /**
   * 清理閒置房間
   */
  async cleanupIdleRooms(inactiveMinutes: number = 30): Promise<{
    cleaned: number;
    rooms: string[];
  }> {
    try {
      const idleRooms = await this.getIdleRooms(inactiveMinutes);
      
      if (idleRooms.length === 0) {
        return { cleaned: 0, rooms: [] };
      }

      const roomCodes = idleRooms.map(room => room.roomCode);
      
      // 更新房間狀態為等待中
      await this.updateRoomStatuses(roomCodes, 'waiting');
      
      // 更新對應的遊戲狀態
      const placeholders = roomCodes.map(() => '?').join(',');
      await this.env.DB.prepare(`
        UPDATE games 
        SET status = 'waiting', updated_at = ?1
        WHERE id IN (
          SELECT game_id FROM rooms 
          WHERE code IN (${placeholders})
        )
      `).bind(Date.now(), ...roomCodes).run();

      console.log(`已清理 ${roomCodes.length} 個閒置房間`);
      
      return {
        cleaned: roomCodes.length,
        rooms: roomCodes
      };
    } catch (error) {
      console.error('清理閒置房間失敗:', error);
      return { cleaned: 0, rooms: [] };
    }
  }

  /**
   * 獲取房間統計信息
   */
  async getRoomStatistics(): Promise<{
    totalRooms: number;
    activeRooms: number;
    waitingRooms: number;
    playingRooms: number;
    finishedRooms: number;
    idleRooms: number;
  }> {
    try {
      const [totalResult, statusResult, idleResult] = await Promise.all([
        this.env.DB.prepare(`
          SELECT COUNT(*) as total FROM rooms
        `).first(),
        
        this.env.DB.prepare(`
          SELECT status, COUNT(*) as count 
          FROM rooms 
          GROUP BY status
        `).all(),
        
        this.env.DB.prepare(`
          SELECT COUNT(*) as idle
          FROM rooms r
          JOIN games g ON r.game_id = g.id
          WHERE r.status IN ('waiting', 'playing')
          AND g.updated_at < ?1
        `).bind(Date.now() - (30 * 60 * 1000)).first()
      ]);

      const totalRooms = totalResult?.total as number || 0;
      const idleRooms = idleResult?.idle as number || 0;
      
      const statusCounts = statusResult.results.reduce((acc, row) => {
        acc[row.status as string] = row.count as number;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalRooms,
        activeRooms: (statusCounts.waiting || 0) + (statusCounts.playing || 0),
        waitingRooms: statusCounts.waiting || 0,
        playingRooms: statusCounts.playing || 0,
        finishedRooms: statusCounts.finished || 0,
        idleRooms
      };
    } catch (error) {
      console.error('獲取房間統計失敗:', error);
      return {
        totalRooms: 0,
        activeRooms: 0,
        waitingRooms: 0,
        playingRooms: 0,
        finishedRooms: 0,
        idleRooms: 0
      };
    }
  }

  /**
   * 強制清理特定房間
   */
  async forceCleanupRoom(roomCode: string): Promise<boolean> {
    try {
      // 更新房間狀態
      await this.env.DB.prepare(`
        UPDATE rooms 
        SET status = 'waiting' 
        WHERE code = ?1
      `).bind(roomCode).run();

      // 更新遊戲狀態
      await this.env.DB.prepare(`
        UPDATE games 
        SET status = 'waiting', updated_at = ?1
        WHERE id = (
          SELECT game_id FROM rooms WHERE code = ?2
        )
      `).bind(Date.now(), roomCode).run();

      console.log(`已強制清理房間: ${roomCode}`);
      return true;
    } catch (error) {
      console.error(`強制清理房間 ${roomCode} 失敗:`, error);
      return false;
    }
  }

  /**
   * 獲取房間詳細信息
   */
  async getRoomDetails(roomCode: string): Promise<{
    roomCode: string;
    gameId: string;
    status: string;
    mode: string;
    players: {
      black: string | null;
      white: string | null;
    };
    createdAt: number;
    lastActivity: number;
    isActive: boolean;
  } | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT r.code, r.game_id, r.status, r.created_at,
               g.mode, g.black_player_id, g.white_player_id, g.updated_at
        FROM rooms r
        JOIN games g ON r.game_id = g.id
        WHERE r.code = ?1
      `).bind(roomCode).first();

      if (!result) return null;

      const lastActivity = result.updated_at as number;
      const isActive = (Date.now() - lastActivity) < (30 * 60 * 1000); // 30分鐘內有活動

      return {
        roomCode: result.code as string,
        gameId: result.game_id as string,
        status: result.status as string,
        mode: result.mode as string,
        players: {
          black: result.black_player_id as string | null,
          white: result.white_player_id as string | null
        },
        createdAt: result.created_at as number,
        lastActivity,
        isActive
      };
    } catch (error) {
      console.error(`獲取房間 ${roomCode} 詳細信息失敗:`, error);
      return null;
    }
  }

  /**
   * 定期清理任務（建議每小時執行一次）
   */
  async performScheduledCleanup(): Promise<{
    cleaned: number;
    rooms: string[];
    statistics: any;
  }> {
    console.log('開始執行定期房間清理任務');
    
    const cleanupResult = await this.cleanupIdleRooms(30); // 30分鐘無活動
    const statistics = await this.getRoomStatistics();
    
    console.log('定期清理任務完成:', {
      cleaned: cleanupResult.cleaned,
      statistics
    });
    
    return {
      ...cleanupResult,
      statistics
    };
  }
}
