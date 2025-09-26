/**
 * 房間 API 處理器
 */

import { Env } from '../types';
import { corsHeaders } from '../utils/cors';

export async function handleRoomAPI(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
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
      if (path.includes('/cleanup')) {
        // 處理手動清理：/ROOMCODE/cleanup
        const pathParts = path.split('/');
        const roomCode = pathParts[1];
        if (roomCode && roomCode.length === 4) {
          return handleForceCleanup(roomCode, env);
        }
      }
      break;

    case 'GET':
      if (path.includes('/websocket')) {
        // 處理 WebSocket 連接：/ROOMCODE/websocket
        const pathParts = path.split('/');
        const roomCode = pathParts[1]; // 第一個部分是房間代碼
        if (roomCode && roomCode.length === 4) {
          return handleWebSocket(request, env, roomCode);
        }
      } else if (path.includes('/stats')) {
        // 處理房間統計：/ROOMCODE/stats
        const pathParts = path.split('/');
        const roomCode = pathParts[1];
        if (roomCode && roomCode.length === 4) {
          return handleGetRoomStats(roomCode, env);
        }
      } else if (path.startsWith('/')) {
        const roomCode = path.substring(1);
        if (roomCode && roomCode.length === 4) {
          return handleGetRoom(roomCode, env);
        }
      }
      break;
  }

  return new Response('Not found', {
    status: 404,
    headers: corsHeaders,
  });
}

/**
 * 創建房間
 */
async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  try {
    const { mode, userId } = (await request.json()) as {
      mode: 'pvp' | 'ai';
      userId: string;
    };

    // 生成隨機房間代碼
    const roomCode = generateRoomCode();

    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 創建房間
    const response = await gameRoom.fetch(
      new Request('http://localhost/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, userId }),
      })
    );

    if (!response.ok) {
      throw new Error('創建房間失敗');
    }

    const result = (await response.json()) as {
      roomCode: string;
      gameId: string;
    };

    // 先確保用戶存在
    const existingUser = await env.DB.prepare(
      `
      SELECT id FROM users WHERE id = ?1
    `
    )
      .bind(userId)
      .first();

    if (!existingUser) {
      // 創建匿名用戶
      await env.DB.prepare(
        `
        INSERT OR IGNORE INTO users (id, username, wins, losses, draws, rating, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `
      )
        .bind(
          userId,
          `匿名玩家_${userId.slice(-6)}`,
          0,
          0,
          0,
          1200,
          Date.now(),
          Date.now()
        )
        .run();
    }

    // 保存遊戲記錄到 D1 資料庫
    await env.DB.prepare(
      `
      INSERT INTO games (
        id, board_state, current_player, status, mode, 
        room_code, black_player_id, white_player_id, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `
    )
      .bind(
        result.gameId,
        JSON.stringify(
          Array(15)
            .fill(null)
            .map(() => Array(15).fill(null))
        ), // 空棋盤
        'black',
        'waiting',
        mode,
        result.roomCode,
        mode === 'pvp' ? userId : userId, // 修正：PVP 模式也設置創建房間的玩家為黑棋
        null,
        Date.now(),
        Date.now()
      )
      .run();

    // 保存房間信息到資料庫
    await env.DB.prepare(
      `
      INSERT INTO rooms (code, game_id, status, created_at)
      VALUES (?1, ?2, ?3, ?4)
    `
    )
      .bind(result.roomCode, result.gameId, 'waiting', Date.now())
      .run();

    return new Response(
      JSON.stringify({
        roomCode: result.roomCode,
        gameId: result.gameId,
        websocketUrl: `/api/room/${result.roomCode}/websocket`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('創建房間失敗:', error);
    return new Response(
      JSON.stringify({
        error: '創建房間失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * 加入房間
 */
async function handleJoinRoom(request: Request, env: Env): Promise<Response> {
  try {
    const { roomCode, userId } = (await request.json()) as {
      roomCode: string;
      userId: string;
    };

    // 檢查房間是否存在
    const roomData = await env.DB.prepare(
      `
      SELECT * FROM rooms WHERE code = ?1
    `
    )
      .bind(roomCode)
      .first();

    if (!roomData) {
      return new Response(
        JSON.stringify({
          error: '房間不存在',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 加入房間，將房間代碼傳遞給 Durable Object
    const response = await gameRoom.fetch(
      new Request(`http://localhost/join/${roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, userId }),
      })
    );

    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify(error), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        ...(result as Record<string, any>),
        websocketUrl: `/api/room/${roomCode}/websocket`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('加入房間失敗:', error);
    return new Response(
      JSON.stringify({
        error: '加入房間失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * 獲取房間信息
 */
async function handleGetRoom(roomCode: string, env: Env): Promise<Response> {
  try {
    // 檢查房間是否存在
    const roomData = await env.DB.prepare(
      `
      SELECT * FROM rooms WHERE code = ?1
    `
    )
      .bind(roomCode)
      .first();

    if (!roomData) {
      return new Response(
        JSON.stringify({
          error: '房間不存在',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 獲取房間狀態
    const response = await gameRoom.fetch(
      new Request('http://localhost/state')
    );

    if (!response.ok) {
      throw new Error('獲取房間狀態失敗');
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        ...(result as Record<string, any>),
        websocketUrl: `/api/room/${roomCode}/websocket`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('獲取房間信息失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取房間信息失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
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

    // 轉發 WebSocket 請求，保留查詢參數並添加房間代碼
    const originalUrl = new URL(request.url);
    const forwardUrl = `http://localhost/websocket${originalUrl.search}&roomCode=${roomCode}`;

    console.log(`轉發 WebSocket 請求: ${forwardUrl}`);

    return await gameRoom.fetch(
      new Request(forwardUrl, {
        method: request.method,
        headers: request.headers,
      })
    );
  } catch (error) {
    console.error('處理 WebSocket 連接失敗:', error);
    return new Response('WebSocket connection failed', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * 獲取房間統計信息
 */
async function handleGetRoomStats(
  roomCode: string,
  env: Env
): Promise<Response> {
  try {
    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 獲取房間統計
    const response = await gameRoom.fetch(
      new Request('http://localhost/stats')
    );

    if (!response.ok) {
      throw new Error('獲取房間統計失敗');
    }

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('獲取房間統計失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取房間統計失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * 手動觸發房間清理
 */
async function handleForceCleanup(
  roomCode: string,
  env: Env
): Promise<Response> {
  try {
    // 獲取 Durable Object 實例
    const id = env.GAME_ROOM.idFromName(roomCode);
    const gameRoom = env.GAME_ROOM.get(id);

    // 觸發清理
    const response = await gameRoom.fetch(
      new Request('http://localhost/cleanup', {
        method: 'POST',
      })
    );

    if (!response.ok) {
      throw new Error('觸發房間清理失敗');
    }

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('觸發房間清理失敗:', error);
    return new Response(
      JSON.stringify({
        error: '觸發房間清理失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
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
