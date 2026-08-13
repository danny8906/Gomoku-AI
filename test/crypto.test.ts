import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  legacySha256Hex,
  timingSafeEqual,
} from '../src/utils/crypto';

describe('hashPassword / verifyPassword', () => {
  it('接受正確密碼', async () => {
    const stored = await hashPassword('correct-horse-1');
    const { valid, needsUpgrade } = await verifyPassword('correct-horse-1', stored);

    expect(valid).toBe(true);
    expect(needsUpgrade).toBe(false);
  });

  it('拒絕錯誤密碼', async () => {
    const stored = await hashPassword('correct-horse-1');

    expect((await verifyPassword('wrong-password-1', stored)).valid).toBe(false);
  });

  it('相同密碼每次產生不同雜湊（有隨機鹽）', async () => {
    const a = await hashPassword('same-password-1');
    const b = await hashPassword('same-password-1');

    expect(a).not.toBe(b);
    expect((await verifyPassword('same-password-1', a)).valid).toBe(true);
    expect((await verifyPassword('same-password-1', b)).valid).toBe(true);
  });

  it('雜湊格式含演算法與疊代次數', async () => {
    const stored = await hashPassword('format-check-1');

    expect(stored.split('$')).toHaveLength(4);
    expect(stored.startsWith('pbkdf2$')).toBe(true);
  });

  it('舊的無鹽 SHA-256 仍可驗證，並標記需升級', async () => {
    const legacy = await legacySha256Hex('old-password-1');
    const { valid, needsUpgrade } = await verifyPassword('old-password-1', legacy);

    expect(valid).toBe(true);
    expect(needsUpgrade).toBe(true);
  });

  it('舊格式的錯誤密碼一樣被拒絕', async () => {
    const legacy = await legacySha256Hex('old-password-1');

    expect((await verifyPassword('other-password-1', legacy)).valid).toBe(false);
  });

  it('空的儲存值不會通過驗證', async () => {
    expect((await verifyPassword('anything-1', '')).valid).toBe(false);
  });

  it('格式毀損的雜湊不會通過驗證', async () => {
    expect((await verifyPassword('anything-1', 'pbkdf2$abc$$')).valid).toBe(false);
  });
});

describe('timingSafeEqual', () => {
  it('相同字串回傳 true', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('不同字串回傳 false', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('長度不同回傳 false', () => {
    expect(timingSafeEqual('abc', 'abcdef')).toBe(false);
  });

  it('處理非 ASCII 字元', () => {
    expect(timingSafeEqual('密碼', '密碼')).toBe(true);
    expect(timingSafeEqual('密碼', '密瑪')).toBe(false);
  });
});
