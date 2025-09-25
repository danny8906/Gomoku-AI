/**
 * Cron Job 處理器 - 定期清理和維護任務
 */

import { Env } from '../types';
import { RoomService } from '../database/RoomService';

export async function handleCron(env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('開始執行定期維護任務');
  
  const roomService = new RoomService(env);
  
  try {
    // 執行房間清理
    const cleanupResult = await roomService.performScheduledCleanup();
    
    console.log('定期清理任務完成:', {
      cleaned: cleanupResult.cleaned,
      rooms: cleanupResult.rooms,
      statistics: cleanupResult.statistics
    });
    
    // 記錄清理結果到日誌
    if (cleanupResult.cleaned > 0) {
      console.log(`已清理 ${cleanupResult.cleaned} 個閒置房間:`, cleanupResult.rooms);
    }
    
  } catch (error) {
    console.error('定期維護任務執行失敗:', error);
  }
}

/**
 * 每小時執行的清理任務
 */
export async function handleHourlyCleanup(env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('執行每小時清理任務');
  await handleCron(env, ctx);
}

/**
 * 每天執行的深度清理任務
 */
export async function handleDailyCleanup(env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('執行每日深度清理任務');
  
  const roomService = new RoomService(env);
  
  try {
    // 清理超過 24 小時無活動的房間
    const cleanupResult = await roomService.cleanupIdleRooms(24 * 60);
    
    console.log('每日深度清理完成:', {
      cleaned: cleanupResult.cleaned,
      rooms: cleanupResult.rooms
    });
    
    // 獲取統計信息
    const stats = await roomService.getRoomStatistics();
    console.log('當前房間統計:', stats);
    
  } catch (error) {
    console.error('每日深度清理任務執行失敗:', error);
  }
}
