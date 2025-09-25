/**
 * 用戶 API 處理器
 */

import { Env } from '../types';
import { UserService } from '../database/UserService';
import { corsHeaders } from '../utils/cors';

/**
 * 密碼強度驗證
 */
function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: '密碼不能為空' };
  }
  
  if (password.length < 6) {
    return { isValid: false, error: '密碼至少需要 6 個字符' };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: '密碼不能超過 128 個字符' };
  }
  
  // 檢查是否包含至少一個字母和一個數字
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  
  if (!hasLetter) {
    return { isValid: false, error: '密碼必須包含至少一個字母' };
  }
  
  if (!hasNumber) {
    return { isValid: false, error: '密碼必須包含至少一個數字' };
  }
  
  return { isValid: true };
}

/**
 * 生成 JWT token
 */
async function generateJWT(userId: string, username: string, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    sub: userId,
    username: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 小時過期
  };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * 驗證 JWT token
 */
async function verifyJWT(token: string, secret: string): Promise<{ valid: boolean; payload?: any }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false };
    }
    
    const [header, payload, signature] = parts;
    
    // 驗證簽名
    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      new TextEncoder().encode(`${header}.${payload}`)
    );
    
    const expectedSignatureB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)));
    
    if (signature !== expectedSignatureB64) {
      return { valid: false };
    }
    
    // 解析 payload
    const decodedPayload = JSON.parse(atob(payload || ''));
    
    // 檢查過期時間
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }
    
    return { valid: true, payload: decodedPayload };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * 驗證 JWT token 並獲取用戶信息
 */
async function authenticateUser(request: Request, env: Env): Promise<{ userId: string; username: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const verification = await verifyJWT(token, env.JWT_SECRET || 'default-secret');
  
  if (!verification.valid || !verification.payload) {
    return null;
  }
  
  return {
    userId: verification.payload.sub,
    username: verification.payload.username
  };
}

export async function handleUserAPI(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/user', '');

  switch (request.method) {
    case 'POST':
      if (path === '/register') {
        return handleRegister(request, env);
      }
      if (path === '/login') {
        return handleLogin(request, env);
      }
      if (path === '/change-password') {
        return handleChangePassword(request, env);
      }
      break;

    case 'GET':
      if (path.startsWith('/profile/')) {
        const userId = path.replace('/profile/', '');
        return handleGetProfile(userId, env);
      }
      if (path === '/leaderboard') {
        return handleGetLeaderboard(request, env);
      }
      if (path.startsWith('/history/')) {
        const userId = path.replace('/history/', '');
        return handleGetHistory(userId, env);
      }
      if (path.startsWith('/stats/')) {
        const userId = path.replace('/stats/', '');
        return handleGetStats(userId, env);
      }
      if (path === '/search') {
        return handleSearchUsers(request, env);
      }
      if (path === '/me') {
        return handleGetMe(request, env);
      }
      break;
  }

  return new Response('Not found', { 
    status: 404,
    headers: corsHeaders
  });
}

/**
 * 用戶註冊
 */
async function handleRegister(request: Request, env: Env): Promise<Response> {
  try {
    const { username, email, password } = await request.json() as {
      username: string;
      email?: string;
      password?: string;
    };

    if (!username || username.length < 3) {
      return new Response(JSON.stringify({ 
        error: '用戶名至少需要 3 個字符' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 密碼強度驗證
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return new Response(JSON.stringify({ 
          error: passwordValidation.error 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    const userService = new UserService(env);
    
    // 檢查用戶名是否已存在
    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return new Response(JSON.stringify({ 
        error: '用戶名已存在' 
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 簡單的密碼哈希（生產環境應使用更安全的方法）
    const passwordHash = password ? 
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
        .then(buffer => Array.from(new Uint8Array(buffer))
          .map(b => b.toString(16).padStart(2, '0')).join('')) : 
      undefined;

    const user = await userService.createUser(username, email, passwordHash);

    // 生成 JWT token
    const token = await generateJWT(user.id, user.username, env.JWT_SECRET || 'default-secret');

    return new Response(JSON.stringify({ 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        rating: user.rating
      },
      token
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('用戶註冊失敗:', error);
    return new Response(JSON.stringify({ 
      error: '註冊失敗',
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
 * 用戶登入
 */
async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password } = await request.json() as {
      username: string;
      password: string;
    };

    const userService = new UserService(env);
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return new Response(JSON.stringify({ 
        error: '用戶不存在' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 密碼驗證
    if (password) {
      const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
        .then(buffer => Array.from(new Uint8Array(buffer))
          .map(b => b.toString(16).padStart(2, '0')).join(''));
      
      // 從資料庫獲取用戶的密碼哈希
      const userWithPassword = await userService.getUserByUsernameWithPassword(username);
      if (!userWithPassword || !userWithPassword.passwordHash) {
        return new Response(JSON.stringify({ 
          error: '用戶不存在或未設置密碼' 
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // 比較密碼哈希
      if (passwordHash !== userWithPassword.passwordHash) {
        return new Response(JSON.stringify({ 
          error: '密碼錯誤' 
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    } else {
      return new Response(JSON.stringify({ 
        error: '請輸入密碼' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 生成 JWT token
    const token = await generateJWT(user.id, user.username, env.JWT_SECRET || 'default-secret');

    return new Response(JSON.stringify({ 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        rating: user.rating
      },
      token
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('用戶登入失敗:', error);
    return new Response(JSON.stringify({ 
      error: '登入失敗',
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
 * 獲取用戶資料
 */
async function handleGetProfile(userId: string, env: Env): Promise<Response> {
  try {
    const userService = new UserService(env);
    const user = await userService.getUserById(userId);

    if (!user) {
      return new Response(JSON.stringify({ 
        error: '用戶不存在' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({ 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        rating: user.rating,
        createdAt: user.createdAt
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取用戶資料失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取用戶資料失敗',
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
 * 獲取排行榜
 */
async function handleGetLeaderboard(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const userService = new UserService(env);
    const leaderboard = await userService.getLeaderboard(limit);

    return new Response(JSON.stringify({ leaderboard }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取排行榜失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取排行榜失敗',
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
 * 獲取用戶遊戲歷史
 */
async function handleGetHistory(userId: string, env: Env): Promise<Response> {
  try {
    const userService = new UserService(env);
    const history = await userService.getUserGameHistory(userId);

    return new Response(JSON.stringify({ history }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取遊戲歷史失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取遊戲歷史失敗',
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
 * 獲取用戶統計
 */
async function handleGetStats(userId: string, env: Env): Promise<Response> {
  try {
    const userService = new UserService(env);
    const stats = await userService.getUserStats(userId);

    return new Response(JSON.stringify({ stats }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取用戶統計失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取用戶統計失敗',
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
 * 搜索用戶
 */
async function handleSearchUsers(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!query) {
      return new Response(JSON.stringify({ 
        error: '缺少搜索查詢' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const userService = new UserService(env);
    const users = await userService.searchUsers(query, limit);

    return new Response(JSON.stringify({ 
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        rating: user.rating,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws
      }))
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('搜索用戶失敗:', error);
    return new Response(JSON.stringify({ 
      error: '搜索用戶失敗',
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
 * 獲取當前用戶信息
 */
async function handleGetMe(request: Request, env: Env): Promise<Response> {
  try {
    const auth = await authenticateUser(request, env);
    if (!auth) {
      return new Response(JSON.stringify({ 
        error: '未授權，請先登入' 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const userService = new UserService(env);
    const user = await userService.getUserById(auth.userId);

    if (!user) {
      return new Response(JSON.stringify({ 
        error: '用戶不存在' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({ 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        rating: user.rating
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取用戶信息失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取用戶信息失敗',
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
 * 更改密碼
 */
async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  try {
    const auth = await authenticateUser(request, env);
    if (!auth) {
      return new Response(JSON.stringify({ 
        error: '未授權，請先登入' 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const { currentPassword, newPassword } = await request.json() as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ 
        error: '請提供當前密碼和新密碼' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 驗證新密碼強度
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return new Response(JSON.stringify({ 
        error: passwordValidation.error 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const userService = new UserService(env);
    
    // 獲取用戶信息（包含密碼哈希）
    const userWithPassword = await userService.getUserByUsernameWithPassword(auth.username);
    if (!userWithPassword || !userWithPassword.passwordHash) {
      return new Response(JSON.stringify({ 
        error: '用戶不存在或未設置密碼' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 驗證當前密碼
    const currentPasswordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentPassword))
      .then(buffer => Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0')).join(''));

    if (currentPasswordHash !== userWithPassword.passwordHash) {
      return new Response(JSON.stringify({ 
        error: '當前密碼錯誤' 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 生成新密碼哈希
    const newPasswordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newPassword))
      .then(buffer => Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0')).join(''));

    // 更新密碼
    await userService.updateUserPassword(auth.userId, newPasswordHash);

    return new Response(JSON.stringify({ 
      message: '密碼更改成功' 
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('更改密碼失敗:', error);
    return new Response(JSON.stringify({ 
      error: '更改密碼失敗',
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
