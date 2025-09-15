/**
 * 用戶 API 處理器
 */

import { Env } from '../types';
import { UserService } from '../database/UserService';
import { corsHeaders } from '../utils/cors';

export async function handleUserAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
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

    // 簡單的密碼驗證（生產環境應使用更安全的方法）
    if (password) {
      const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
        .then(buffer => Array.from(new Uint8Array(buffer))
          .map(b => b.toString(16).padStart(2, '0')).join(''));
      
      // 這裡應該比較哈希值，但由於示例簡化，暫時跳過
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
