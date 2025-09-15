/**
 * 房間 API 處理器
 */

import { Env } from '../types';
import { corsHeaders } from '../utils/cors';

export async function handleRoomAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/room', '');

  switch (request.method) {
    case 'POST':
      if (path === '/create') {
        return handleCreateRoom(request, env);
      }
      if (path === '/join') {
        return handleJoinRoom(request, env);
      }
      break;

    case 'GET':
      if (path.startsWith('/')) {
        const roomCode = path.substring(1);
        if (roomCode) {
          return handleGetRoom(roomCode, env);
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
 * 創建房間
 */
async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  try {
    const { mode, userId } = await request.json() as {
      mode: 'pvp' | 'ai';
      userId: string;
    };

    // 生成隨機房間代碼
    const roomCode = generateRoomCode();
    
    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 創建房間
    const response = await gameRoom.fetch(new Request('http://localhost/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, userId })
    }));

    if (!response.ok) {
      throw new Error('創建房間失敗');
    }

    const result = await response.json() as { roomCode: string; gameId: string };

    // 保存房間信息到資料庫
    await env.DB.prepare(`
      INSERT INTO rooms (code, game_id, status, created_at)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(
      result.roomCode,
      result.gameId,
      'waiting',
      Date.now()
    ).run();

    return new Response(JSON.stringify({
      roomCode: result.roomCode,
      gameId: result.gameId,
      websocketUrl: `/api/room/${result.roomCode}/websocket`
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('創建房間失敗:', error);
    return new Response(JSON.stringify({ 
      error: '創建房間失敗',
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
 * 加入房間
 */
async function handleJoinRoom(request: Request, env: Env): Promise<Response> {
  try {
    const { roomCode, userId } = await request.json() as {
      roomCode: string;
      userId: string;
    };

    // 檢查房間是否存在
    const roomData = await env.DB.prepare(`
      SELECT * FROM rooms WHERE code = ?1
    `).bind(roomCode).first();

    if (!roomData) {
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

    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 加入房間
    const response = await gameRoom.fetch(new Request('http://localhost/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode })
    }));

    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify(error), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const result = await response.json();

    return new Response(JSON.stringify({
      ...result,
      websocketUrl: `/api/room/${roomCode}/websocket`
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('加入房間失敗:', error);
    return new Response(JSON.stringify({ 
      error: '加入房間失敗',
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
 * 獲取房間信息
 */
async function handleGetRoom(roomCode: string, env: Env): Promise<Response> {
  try {
    // 檢查房間是否存在
    const roomData = await env.DB.prepare(`
      SELECT * FROM rooms WHERE code = ?1
    `).bind(roomCode).first();

    if (!roomData) {
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

    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 獲取房間狀態
    const response = await gameRoom.fetch(new Request('http://localhost/state'));

    if (!response.ok) {
      throw new Error('獲取房間狀態失敗');
    }

    const result = await response.json();

    return new Response(JSON.stringify({
      ...result,
      websocketUrl: `/api/room/${roomCode}/websocket`
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取房間信息失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取房間信息失敗',
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
 * 處理 WebSocket 連接
 */
export async function handleWebSocket(
  request: Request,
  env: Env,
  roomCode: string
): Promise<Response> {
  try {
    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 轉發 WebSocket 請求
    return await gameRoom.fetch(new Request('http://localhost/websocket', {
      headers: request.headers
    }));
  } catch (error) {
    console.error('處理 WebSocket 連接失敗:', error);
    return new Response('WebSocket connection failed', { 
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * 生成 4 位房間代碼
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
