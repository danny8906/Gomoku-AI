/**
 * CORS 工具函數
 *
 * 前端與 API 由同一個 Worker 提供，正常情況下是同源請求、不需要 CORS。
 * 因此預設不發出 Access-Control-Allow-Origin，只有來源符合允許清單時才回應，
 * 避免任意網站都能代使用者呼叫本 API。
 */

import { Env } from '../types';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

/**
 * 判斷請求來源是否允許跨域
 *
 * 允許同源，以及 ALLOWED_ORIGINS（逗號分隔）明列的來源。
 */
export function resolveAllowedOrigin(
  request: Request,
  env: Env
): string | null {
  const origin = request.headers.get('Origin');

  // 沒有 Origin 代表同源或非瀏覽器請求，不需要 CORS 標頭
  if (!origin) return null;

  try {
    if (origin === new URL(request.url).origin) {
      return origin;
    }
  } catch {
    return null;
  }

  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  return allowed.includes(origin) ? origin : null;
}

/**
 * 為回應補上允許的來源標頭
 *
 * WebSocket 升級（101）的回應不可變動，直接原樣回傳。
 */
export function withCors(
  response: Response,
  request: Request,
  env: Env
): Response {
  if (response.status === 101 || (response as any).webSocket) {
    return response;
  }

  const origin = resolveAllowedOrigin(request, env);
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.append('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
