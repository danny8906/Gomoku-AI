/**
 * 管理員 API 處理器 - 房間管理和監控
 */

import { Env } from '../types';
import { corsHeaders } from '../utils/cors';
import { RoomService } from '../database/RoomService';
import { verifyAdminPassword, setAdminPassword } from '../utils/auth';

export async function handleAdminAPI(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/admin', '');

  // 認證檢查
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: '需要認證' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const token = authHeader.substring(7); // 移除 'Bearer ' 前綴
  
  // 驗證管理員密碼
  const isValid = await verifyAdminPassword(token, env);
  if (!isValid) {
    return new Response(JSON.stringify({ error: '無效的認證令牌' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const roomService = new RoomService(env);

  switch (request.method) {
    case 'GET':
      if (path === '/rooms') {
        return handleGetAllRooms(roomService);
      }
      if (path === '/rooms/active') {
        return handleGetActiveRooms(roomService);
      }
      if (path === '/rooms/idle') {
        const inactiveMinutes = parseInt(url.searchParams.get('minutes') || '30');
        return handleGetIdleRooms(roomService, inactiveMinutes);
      }
      if (path === '/rooms/stats') {
        return handleGetRoomStats(roomService);
      }
      if (path.startsWith('/rooms/')) {
        const roomCode = path.split('/')[2];
        if (roomCode && roomCode.length === 4) {
          return handleGetRoomDetails(roomService, roomCode);
        }
      }
      break;

    case 'POST':
      if (path === '/rooms/cleanup') {
        return handleCleanupRooms(roomService);
      }
      if (path === '/database/clear') {
        return handleClearDatabase(env);
      }
      if (path === '/password/set') {
        return handleSetPassword(request, env);
      }
      if (path.startsWith('/rooms/')) {
        const roomCode = path.split('/')[2];
        if (roomCode && roomCode.length === 4 && path.includes('/cleanup')) {
          return handleCleanupRoom(roomService, roomCode);
        }
      }
      break;
  }

  return new Response('Not found', { 
    status: 404,
    headers: corsHeaders
  });
}

/**
 * 獲取所有房間
 */
async function handleGetAllRooms(roomService: RoomService): Promise<Response> {
  try {
    const rooms = await roomService.getActiveRooms();
    
    return new Response(JSON.stringify({
      rooms,
      count: rooms.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取所有房間失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取房間失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 獲取活躍房間
 */
async function handleGetActiveRooms(roomService: RoomService): Promise<Response> {
  try {
    const rooms = await roomService.getActiveRooms();
    
    return new Response(JSON.stringify({
      rooms,
      count: rooms.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取活躍房間失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取活躍房間失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 獲取閒置房間
 */
async function handleGetIdleRooms(roomService: RoomService, inactiveMinutes: number): Promise<Response> {
  try {
    const rooms = await roomService.getIdleRooms(inactiveMinutes);
    
    return new Response(JSON.stringify({
      rooms,
      count: rooms.length,
      inactiveMinutes
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取閒置房間失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取閒置房間失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 獲取房間統計
 */
async function handleGetRoomStats(roomService: RoomService): Promise<Response> {
  try {
    const stats = await roomService.getRoomStatistics();
    
    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取房間統計失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取房間統計失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 獲取房間詳細信息
 */
async function handleGetRoomDetails(roomService: RoomService, roomCode: string): Promise<Response> {
  try {
    const details = await roomService.getRoomDetails(roomCode);
    
    if (!details) {
      return new Response(JSON.stringify({ 
        error: '房間不存在' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    return new Response(JSON.stringify(details), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取房間詳細信息失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取房間詳細信息失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 清理所有閒置房間
 */
async function handleCleanupRooms(roomService: RoomService): Promise<Response> {
  try {
    const result = await roomService.performScheduledCleanup();
    
    return new Response(JSON.stringify({
      message: '房間清理完成',
      ...result
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('清理房間失敗:', error);
    return new Response(JSON.stringify({ 
      error: '清理房間失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 清理特定房間
 */
async function handleCleanupRoom(roomService: RoomService, roomCode: string): Promise<Response> {
  try {
    const success = await roomService.forceCleanupRoom(roomCode);
    
    if (!success) {
      return new Response(JSON.stringify({ 
        error: '清理房間失敗' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    return new Response(JSON.stringify({
      message: `房間 ${roomCode} 清理完成`,
      roomCode
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error(`清理房間 ${roomCode} 失敗:`, error);
    return new Response(JSON.stringify({ 
      error: '清理房間失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 設置管理員密碼
 */
async function handleSetPassword(request: Request, env: Env): Promise<Response> {
  try {
    const { password } = await request.json() as { password: string };
    
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ 
        error: '密碼長度至少需要 6 個字符' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const success = await setAdminPassword(password, env);
    
    if (!success) {
      return new Response(JSON.stringify({ 
        error: '設置密碼失敗' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({
      message: '管理員密碼設置成功'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('設置管理員密碼失敗:', error);
    return new Response(JSON.stringify({ 
      error: '設置密碼失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 清空資料庫所有資料
 */
async function handleClearDatabase(env: Env): Promise<Response> {
  try {
    // 按照外鍵約束的正確順序刪除資料
    const deleteQueries = [
      'DELETE FROM game_records',
      'DELETE FROM rooms', 
      'DELETE FROM games',
      'DELETE FROM users'
    ];

    const results = [];
    for (const query of deleteQueries) {
      const result = await env.DB.prepare(query).run();
      results.push({
        query,
        changes: result.meta.changes,
        success: result.meta.success
      });
    }

    const totalChanges = results.reduce((sum, r) => sum + r.changes, 0);

    return new Response(JSON.stringify({
      message: '資料庫清空完成',
      totalChanges,
      results
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('清空資料庫失敗:', error);
    return new Response(JSON.stringify({ 
      error: '清空資料庫失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}
