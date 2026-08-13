/**
 * 認證工具：管理員密碼、JWT 簽發與驗證、操作者身分解析
 */

import { Env } from '../types';
import {
  hashPassword,
  verifyPassword,
  timingSafeEqual,
} from './crypto';

const ADMIN_PASSWORD_KEY = 'admin_password';

/**
 * 取得 JWT 簽章金鑰
 *
 * 刻意不提供預設值：若未設定 JWT_SECRET，任何人都能自簽 token 冒充其他使用者，
 * 因此寧可讓需要認證的端點直接失敗，也不要靜默降級成公開已知的金鑰。
 */
export function getJwtSecret(env: Env): string {
  const secret = env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET 未設定或長度不足 32 字元，請執行 `wrangler secret put JWT_SECRET`'
    );
  }

  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function base64UrlDecodeToString(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded.padEnd(
    padded.length + ((4 - (padded.length % 4)) % 4),
    '='
  );
  return new TextDecoder().decode(
    Uint8Array.from(atob(withPadding), c => c.charCodeAt(0))
  );
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export interface JwtPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}

/**
 * 簽發 JWT
 */
export async function generateJWT(
  userId: string,
  username: string,
  env: Env
): Promise<string> {
  const secret = getJwtSecret(env);
  const now = Math.floor(Date.now() / 1000);

  const header = base64UrlEncodeString(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  );
  const payload = base64UrlEncodeString(
    JSON.stringify({
      sub: userId,
      username,
      iat: now,
      exp: now + 24 * 60 * 60,
    })
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    await importSigningKey(secret),
    new TextEncoder().encode(`${header}.${payload}`)
  );

  return `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * 驗證 JWT
 */
export async function verifyJWT(
  token: string,
  env: Env
): Promise<{ valid: boolean; payload?: JwtPayload }> {
  try {
    const secret = getJwtSecret(env);
    const parts = token.split('.');

    if (parts.length !== 3) {
      return { valid: false };
    }

    const [header, payload, signature] = parts;

    const expected = await crypto.subtle.sign(
      'HMAC',
      await importSigningKey(secret),
      new TextEncoder().encode(`${header}.${payload}`)
    );

    if (
      !signature ||
      !timingSafeEqual(signature, base64UrlEncode(new Uint8Array(expected)))
    ) {
      return { valid: false };
    }

    const decoded = JSON.parse(
      base64UrlDecodeToString(payload || '')
    ) as JwtPayload;

    if (
      typeof decoded.exp !== 'number' ||
      decoded.exp < Math.floor(Date.now() / 1000)
    ) {
      return { valid: false };
    }

    if (typeof decoded.sub !== 'string' || !decoded.sub) {
      return { valid: false };
    }

    return { valid: true, payload: decoded };
  } catch (error) {
    console.error('驗證 JWT 失敗:', error);
    return { valid: false };
  }
}

/**
 * 從請求標頭取出並驗證登入者
 */
export async function authenticateUser(
  request: Request,
  env: Env
): Promise<{ userId: string; username: string } | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const verification = await verifyJWT(authHeader.substring(7), env);

  if (!verification.valid || !verification.payload) {
    return null;
  }

  return {
    userId: verification.payload.sub,
    username: verification.payload.username,
  };
}

/**
 * 解析請求真正的操作者
 *
 * 匿名對局本來就允許自帶 userId，但若該 userId 屬於已註冊帳號（設有密碼），
 * 就必須出示有效 JWT，否則任何人都能冒用他人身分累積或破壞戰績。
 */
export async function resolveActor(
  request: Request,
  env: Env,
  claimedUserId: string
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  if (!claimedUserId || typeof claimedUserId !== 'string') {
    return { ok: false, reason: '缺少使用者識別碼' };
  }

  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const verification = await verifyJWT(authHeader.substring(7), env);

    if (!verification.valid || !verification.payload) {
      return { ok: false, reason: '登入憑證無效或已過期' };
    }

    if (verification.payload.sub !== claimedUserId) {
      return { ok: false, reason: '使用者識別碼與登入憑證不符' };
    }

    return { ok: true, userId: verification.payload.sub };
  }

  const registered = await env.DB.prepare(
    `SELECT password_hash FROM users WHERE id = ?1`
  )
    .bind(claimedUserId)
    .first();

  if (registered?.password_hash) {
    return { ok: false, reason: '此帳號需要登入後才能操作' };
  }

  return { ok: true, userId: claimedUserId };
}

/**
 * 驗證管理員密碼
 *
 * 相容既有的明文 KV 值：驗證通過後會自動改寫為雜湊格式。
 */
export async function verifyAdminPassword(
  token: string,
  env: Env
): Promise<boolean> {
  try {
    const stored = await env.gomoku_admin.get(ADMIN_PASSWORD_KEY);

    if (!stored) {
      console.error('管理員密碼未設置');
      return false;
    }

    if (stored.startsWith('pbkdf2$')) {
      const { valid } = await verifyPassword(token, stored);
      return valid;
    }

    // 舊資料為明文，仍以常數時間比較，並在成功後升級為雜湊
    const valid = timingSafeEqual(token, stored);

    if (valid) {
      await env.gomoku_admin.put(ADMIN_PASSWORD_KEY, await hashPassword(token));
      console.log('管理員密碼已自動升級為雜湊格式');
    }

    return valid;
  } catch (error) {
    console.error('驗證管理員密碼失敗:', error);
    return false;
  }
}

/**
 * 設置管理員密碼（以雜湊儲存）
 */
export async function setAdminPassword(
  password: string,
  env: Env
): Promise<boolean> {
  try {
    await env.gomoku_admin.put(ADMIN_PASSWORD_KEY, await hashPassword(password));
    return true;
  } catch (error) {
    console.error('設置管理員密碼失敗:', error);
    return false;
  }
}

/**
 * 檢查管理員密碼是否已設置
 */
export async function isAdminPasswordSet(env: Env): Promise<boolean> {
  try {
    const stored = await env.gomoku_admin.get(ADMIN_PASSWORD_KEY);
    return stored !== null;
  } catch (error) {
    console.error('檢查管理員密碼狀態失敗:', error);
    return false;
  }
}

/**
 * 管理端點共用的授權檢查，未通過時回傳可直接送出的 401
 */
export async function requireAdmin(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: '需要認證' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const isValid = await verifyAdminPassword(authHeader.substring(7), env);

  if (!isValid) {
    return new Response(JSON.stringify({ error: '無效的認證令牌' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return null;
}
