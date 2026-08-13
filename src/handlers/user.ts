/**
 * 用戶 API 處理器
 */

import { Env } from '../types';
import { UserService } from '../database/UserService';
import { corsHeaders } from '../utils/cors';
import { generateJWT, authenticateUser } from '../utils/auth';
import { hashPassword, verifyPassword } from '../utils/crypto';

/**
 * 解析並限制清單類參數，避免 NaN 或過大的查詢
 */
function parseLimit(raw: string | null, fallback = 10, max = 100): number {
  const parsed = Number.parseInt(raw ?? '', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

/**
 * 密碼強度驗證
 */
function validatePassword(password: string): {
  isValid: boolean;
  error?: string;
} {
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
    headers: corsHeaders,
  });
}

/**
 * 用戶註冊
 */
async function handleRegister(request: Request, env: Env): Promise<Response> {
  try {
    const { username, email, password } = (await request.json()) as {
      username: string;
      email?: string;
      password?: string;
    };

    if (!username || username.length < 3) {
      return new Response(
        JSON.stringify({
          error: '用戶名至少需要 3 個字符',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 密碼強度驗證
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return new Response(
          JSON.stringify({
            error: passwordValidation.error,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    const userService = new UserService(env);

    // 檢查用戶名是否已存在
    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: '用戶名已存在',
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const passwordHash = password ? await hashPassword(password) : undefined;

    const user = await userService.createUser(username, email, passwordHash);

    // 生成 JWT token
    const token = await generateJWT(user.id, user.username, env);

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
          rating: user.rating,
        },
        token,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('用戶註冊失敗:', error);
    return new Response(
      JSON.stringify({
        error: '註冊失敗',
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
}

/**
 * 用戶登入
 */
async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password } = (await request.json()) as {
      username: string;
      password: string;
    };

    if (!password) {
      return new Response(JSON.stringify({ error: '請輸入密碼' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const userService = new UserService(env);
    const user = await userService.getUserByUsername(username);
    const userWithPassword = user
      ? await userService.getUserByUsernameWithPassword(username)
      : null;

    // 帳號不存在與密碼錯誤回傳同一則訊息，避免被用來列舉帳號
    const invalidCredentials = new Response(
      JSON.stringify({ error: '帳號或密碼錯誤' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

    if (!user || !userWithPassword?.passwordHash) {
      return invalidCredentials;
    }

    const { valid, needsUpgrade } = await verifyPassword(
      password,
      userWithPassword.passwordHash
    );

    if (!valid) {
      return invalidCredentials;
    }

    // 舊的無鹽 SHA-256 雜湊在登入成功時就地升級為 PBKDF2
    if (needsUpgrade) {
      try {
        await userService.updateUserPassword(
          user.id,
          await hashPassword(password)
        );
        console.log(`已升級使用者 ${user.id} 的密碼雜湊格式`);
      } catch (upgradeError) {
        console.error('升級密碼雜湊失敗:', upgradeError);
      }
    }

    // 生成 JWT token
    const token = await generateJWT(user.id, user.username, env);

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
          rating: user.rating,
        },
        token,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('用戶登入失敗:', error);
    return new Response(
      JSON.stringify({
        error: '登入失敗',
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
}

/**
 * 獲取用戶資料
 */
async function handleGetProfile(userId: string, env: Env): Promise<Response> {
  try {
    const userService = new UserService(env);
    const user = await userService.getUserById(userId);

    if (!user) {
      return new Response(
        JSON.stringify({
          error: '用戶不存在',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
          rating: user.rating,
          createdAt: user.createdAt,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('獲取用戶資料失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取用戶資料失敗',
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
}

/**
 * 獲取排行榜
 */
async function handleGetLeaderboard(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));

    const userService = new UserService(env);
    const leaderboard = await userService.getLeaderboard(limit);

    return new Response(JSON.stringify({ leaderboard }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('獲取排行榜失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取排行榜失敗',
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
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('獲取遊戲歷史失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取遊戲歷史失敗',
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
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('獲取用戶統計失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取用戶統計失敗',
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
}

/**
 * 搜索用戶
 */
async function handleSearchUsers(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = parseLimit(url.searchParams.get('limit'));

    if (!query) {
      return new Response(
        JSON.stringify({
          error: '缺少搜索查詢',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const userService = new UserService(env);
    const users = await userService.searchUsers(query, limit);

    return new Response(
      JSON.stringify({
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          rating: user.rating,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
        })),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('搜索用戶失敗:', error);
    return new Response(
      JSON.stringify({
        error: '搜索用戶失敗',
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
}

/**
 * 獲取當前用戶信息
 */
async function handleGetMe(request: Request, env: Env): Promise<Response> {
  try {
    const auth = await authenticateUser(request, env);
    if (!auth) {
      return new Response(
        JSON.stringify({
          error: '未授權，請先登入',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const userService = new UserService(env);
    const user = await userService.getUserById(auth.userId);

    if (!user) {
      return new Response(
        JSON.stringify({
          error: '用戶不存在',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
          rating: user.rating,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('獲取用戶信息失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取用戶信息失敗',
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
}

/**
 * 更改密碼
 */
async function handleChangePassword(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const auth = await authenticateUser(request, env);
    if (!auth) {
      return new Response(
        JSON.stringify({
          error: '未授權，請先登入',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({
          error: '請提供當前密碼和新密碼',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 驗證新密碼強度
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return new Response(
        JSON.stringify({
          error: passwordValidation.error,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const userService = new UserService(env);

    // 獲取用戶信息（包含密碼哈希）
    const userWithPassword = await userService.getUserByUsernameWithPassword(
      auth.username
    );
    if (!userWithPassword || !userWithPassword.passwordHash) {
      return new Response(
        JSON.stringify({
          error: '用戶不存在或未設置密碼',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 驗證當前密碼
    const { valid } = await verifyPassword(
      currentPassword,
      userWithPassword.passwordHash
    );

    if (!valid) {
      return new Response(
        JSON.stringify({
          error: '當前密碼錯誤',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // 更新密碼
    await userService.updateUserPassword(
      auth.userId,
      await hashPassword(newPassword)
    );

    return new Response(
      JSON.stringify({
        message: '密碼更改成功',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('更改密碼失敗:', error);
    return new Response(
      JSON.stringify({
        error: '更改密碼失敗',
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
}
