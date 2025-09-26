/**
 * 認證工具
 */

import { Env } from '../types';

/**
 * 驗證管理員密碼
 */
export async function verifyAdminPassword(
  token: string,
  env: Env
): Promise<boolean> {
  try {
    // 從 KV 中獲取正確的管理員密碼
    const storedPassword = await env.gomoku_admin.get('admin_password');

    if (!storedPassword) {
      console.error('管理員密碼未設置');
      return false;
    }

    // 簡單的字符串比較（在生產環境中應該使用 bcrypt 等安全哈希）
    return token === storedPassword;
  } catch (error) {
    console.error('驗證管理員密碼失敗:', error);
    return false;
  }
}

/**
 * 設置管理員密碼
 */
export async function setAdminPassword(
  password: string,
  env: Env
): Promise<boolean> {
  try {
    await env.gomoku_admin.put('admin_password', password);
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
    const storedPassword = await env.gomoku_admin.get('admin_password');
    return storedPassword !== null;
  } catch (error) {
    console.error('檢查管理員密碼狀態失敗:', error);
    return false;
  }
}
