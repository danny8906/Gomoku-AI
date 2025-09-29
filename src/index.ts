/**
 * Cloudflare Workers OmniAI 五子棋遊戲主入口
 * 支援 AI 對戰和玩家對戰功能
 */

import { Env } from './types';
import { handleGameAPI } from './handlers/game';
import { handleUserAPI } from './handlers/user';
import { handleRoomAPI } from './handlers/room';
import { handleAdminAPI } from './handlers/admin';
import { handleStartAITraining, handleGetTrainingStats } from './handlers/aiTraining';
import { serveStaticAssets } from './handlers/static';
import { handleHourlyCleanup } from './handlers/cron';
import { corsHeaders } from './utils/cors';

export { GameRoom } from './durable-objects/GameRoom';

// AI 訓練 API 處理器
async function handleAITrainingAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/ai-training', '');

  // 認證檢查（可選）
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: '需要認證' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  switch (request.method) {
    case 'POST':
      if (path === '/start') {
        return await handleStartAITraining(request, env);
      }
      break;

    case 'GET':
      if (path === '/stats') {
        return await handleGetTrainingStats(request, env);
      }
      break;
  }

  return new Response('Not found', {
    status: 404,
    headers: corsHeaders,
  });
}

// Cron Job 處理器
export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`[Cron] 接收到定時任務: ${event.cron}`);
  console.log(`[Cron] 計劃時間: ${event.scheduledTime}`);
  
  try {
    await handleHourlyCleanup(env, ctx);
    console.log('[Cron] 定時任務執行完成');
  } catch (error) {
    console.error('[Cron] 定時任務執行失敗:', error);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    try {
      // API 路由
      if (path.startsWith('/api/game')) {
        return await handleGameAPI(request, env, ctx);
      }

      if (path.startsWith('/api/user')) {
        return await handleUserAPI(request, env, ctx);
      }

      if (path.startsWith('/api/room')) {
        return await handleRoomAPI(request, env, ctx);
      }

      if (path.startsWith('/api/admin')) {
        return await handleAdminAPI(request, env);
      }

      if (path.startsWith('/api/ai-training')) {
        return await handleAITrainingAPI(request, env);
      }

      // 靜態資源和前端頁面
      return await serveStaticAssets(request, env);
    } catch (error) {
      console.error('處理請求時發生錯誤:', error);
      return new Response(
        JSON.stringify({
          error: '伺服器內部錯誤',
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
  },
};
