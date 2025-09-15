/**
 * Cloudflare Workers 五子棋遊戲主入口
 * 支援 AI 對戰和玩家對戰功能
 */

import { Env } from './types';
import { handleGameAPI } from './handlers/game';
import { handleUserAPI } from './handlers/user';
import { handleRoomAPI } from './handlers/room';
import { serveStaticAssets } from './handlers/static';
import { corsHeaders } from './utils/cors';

export { GameRoom } from './durable-objects/GameRoom';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
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

      // 靜態資源和前端頁面
      return await serveStaticAssets(request, env);
      
    } catch (error) {
      console.error('處理請求時發生錯誤:', error);
      return new Response(JSON.stringify({ 
        error: '伺服器內部錯誤',
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
};
