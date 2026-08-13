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
import { corsHeaders, withCors } from './utils/cors';
import { requireAdmin } from './utils/auth';

export { GameRoom } from './durable-objects/GameRoom';

// AI 訓練 API 處理器
async function handleAITrainingAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/ai-training', '');

  // 自我訓練會大量消耗 Workers AI 額度，必須是管理員才能觸發
  const unauthorized = await requireAdmin(request, env, corsHeaders);
  if (unauthorized) {
    return unauthorized;
  }

  switch (request.method) {
    case 'POST':
      if (path === '/start') {
        return await handleStartAITraining(request, env, ctx);
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

// Cron Job 處理器（必須掛在 default export 上，具名 export 不會被 Workers runtime 當作 handler）
async function scheduled(
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
      return withCors(
        new Response(null, { status: 204, headers: corsHeaders }),
        request,
        env
      );
    }

    try {
      // API 路由
      if (path.startsWith('/api/game')) {
        return withCors(await handleGameAPI(request, env, ctx), request, env);
      }

      if (path.startsWith('/api/user')) {
        return withCors(await handleUserAPI(request, env, ctx), request, env);
      }

      if (path.startsWith('/api/room')) {
        return withCors(await handleRoomAPI(request, env, ctx), request, env);
      }

      if (path.startsWith('/api/admin')) {
        return withCors(await handleAdminAPI(request, env, ctx), request, env);
      }

      if (path.startsWith('/api/ai-training')) {
        return withCors(await handleAITrainingAPI(request, env, ctx), request, env);
      }

      // 靜態資源和前端頁面
      return await serveStaticAssets(request, env);
    } catch (error) {
      // 對外只回傳通用訊息，詳細內容留在日誌，避免洩漏內部結構
      console.error('處理請求時發生錯誤:', error);
      return withCors(
        new Response(JSON.stringify({ error: '伺服器內部錯誤' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }),
        request,
        env
      );
    }
  },
  scheduled,
};
