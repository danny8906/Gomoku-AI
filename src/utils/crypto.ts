/**
 * 密碼雜湊與比較工具
 *
 * 密碼以 `pbkdf2$<iterations>$<salt_b64>$<hash_b64>` 格式儲存。
 * 舊資料為 64 字元的無鹽 SHA-256 十六進位字串，驗證時仍可通過，
 * 但會標記 needsUpgrade，由呼叫端在登入成功後改寫成新格式。
 */

const PBKDF2_ITERATIONS = 210000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS
  );

  return new Uint8Array(bits);
}

/**
 * 舊版無鹽 SHA-256（僅供驗證既有資料，不可用於新密碼）
 */
export async function legacySha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 常數時間字串比較，避免以回應時間推測正確值
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);

  // 長度不同時仍走完整個迴圈，只是結果必為 false
  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  const length = Math.max(aBytes.length, bBytes.length);

  for (let i = 0; i < length; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return mismatch === 0;
}

/**
 * 產生新的密碼雜湊
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * 驗證密碼，並回報是否需要升級雜湊格式
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!stored) {
    return { valid: false, needsUpgrade: false };
  }

  if (stored.startsWith('pbkdf2$')) {
    const [, iterationsRaw, saltB64, hashB64] = stored.split('$');
    const iterations = Number(iterationsRaw);

    if (!iterations || !saltB64 || !hashB64) {
      return { valid: false, needsUpgrade: false };
    }

    try {
      const candidate = await deriveBits(
        password,
        fromBase64(saltB64),
        iterations
      );
      const valid = timingSafeEqual(toBase64(candidate), hashB64);
      return { valid, needsUpgrade: valid && iterations < PBKDF2_ITERATIONS };
    } catch (error) {
      console.error('驗證密碼失敗:', error);
      return { valid: false, needsUpgrade: false };
    }
  }

  // 舊格式：無鹽 SHA-256 十六進位
  const legacy = await legacySha256Hex(password);
  const valid = timingSafeEqual(legacy, stored);
  return { valid, needsUpgrade: valid };
}
