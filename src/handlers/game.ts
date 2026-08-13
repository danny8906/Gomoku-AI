/**
 * 遊戲 API 處理器
 */

import { Env, GameState, Position } from '../types';
import { GameLogic } from '../game/GameLogic';
import { AIEngine } from '../ai/AIEngine';
import { VectorizeService } from '../ai/VectorizeService';
import { corsHeaders } from '../utils/cors';
import { saveAIGameRecord } from './gameRecord';
import { detectLanguage, getTranslations, Translations } from '../utils/i18n';
import { resolveActor } from '../utils/auth';

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * 從資料庫列還原遊戲狀態
 */
function toGameState(gameData: Record<string, unknown>): GameState {
  return {
    id: gameData.id as string,
    board: JSON.parse(gameData.board_state as string),
    currentPlayer: gameData.current_player as 'black' | 'white',
    status: gameData.status as 'waiting' | 'playing' | 'finished',
    mode: gameData.mode as 'pvp' | 'ai',
    moves: gameData.moves ? JSON.parse(gameData.moves as string) : [],
    winner: gameData.winner as 'black' | 'white' | 'draw' | null,
    roomCode: (gameData.room_code as string) || undefined,
    players: {
      black: (gameData.black_player_id as string) || undefined,
      white: (gameData.white_player_id as string) || undefined,
    },
    createdAt: gameData.created_at as number,
    updatedAt: gameData.updated_at as number,
  };
}

/** 講評在 KV 的鍵；設 TTL 讓對局結束後自動清掉 */
const commentaryKey = (gameId: string) => `commentary:${gameId}`;
const COMMENTARY_TTL_SECONDS = 60 * 60;

export async function handleGameAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/game', '');
  const language = detectLanguage(request);
  const t = getTranslations(language);

  switch (request.method) {
    case 'POST':
      if (path === '/create') {
        return handleCreateGame(request, env);
      }
      if (path === '/move') {
        return handleMakeMove(request, env, t, ctx);
      }
      if (path === '/ai-move') {
        return handleAIMove(request, env, t, ctx);
      }
      break;

    case 'GET':
      if (path.startsWith('/state/')) {
        const gameId = path.replace('/state/', '');
        return handleGetGameState(gameId, env, t);
      }
      if (path.startsWith('/commentary/')) {
        const gameId = path.replace('/commentary/', '');
        return handleGetCommentary(gameId, env);
      }
      break;
  }

  return new Response('Not found', {
    status: 404,
    headers: corsHeaders,
  });
}

/**
 * 創建新遊戲
 */
async function handleCreateGame(request: Request, env: Env): Promise<Response> {
  try {
    const { mode, userId } = (await request.json()) as {
      mode: 'pvp' | 'ai';
      userId?: string;
    };

    const gameId = crypto.randomUUID();
    const gameState = GameLogic.createGame(gameId, mode);

    // 如果是 AI 模式，設置玩家
    if (mode === 'ai' && userId) {
      // 已註冊帳號必須出示有效 JWT，否則任何人都能冒用他人身分累積戰績
      const actor = await resolveActor(request, env, userId);
      if (!actor.ok) {
        return jsonResponse({ error: actor.reason }, 403);
      }

      // 先檢查用戶是否存在，如果不存在則創建匿名用戶
      const existingUser = await env.DB.prepare(
        `
        SELECT id FROM users WHERE id = ?1
      `
      )
        .bind(userId)
        .first();

      if (!existingUser) {
        // 創建匿名用戶
        await env.DB.prepare(
          `
          INSERT OR IGNORE INTO users (id, username, wins, losses, draws, rating, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        `
        )
          .bind(
            userId,
            `Anonymous_${userId.slice(-6)}`,
            0,
            0,
            0,
            1200,
            Date.now(),
            Date.now()
          )
          .run();
      }

      gameState.players.black = userId;
      gameState.status = 'playing';
    }

    // 保存到資料庫
    await env.DB.prepare(
      `
      INSERT INTO games (
        id, board_state, current_player, status, mode, 
        black_player_id, white_player_id, created_at, updated_at, moves
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `
    )
      .bind(
        gameState.id,
        JSON.stringify(gameState.board),
        gameState.currentPlayer,
        gameState.status,
        gameState.mode,
        gameState.players.black || null,
        gameState.players.white || null,
        gameState.createdAt,
        gameState.updatedAt,
        JSON.stringify(gameState.moves)
      )
      .run();

    return new Response(JSON.stringify({ gameState }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('創建遊戲失敗:', error);
    return new Response(
      JSON.stringify({
        error: '創建遊戲失敗',
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
 * 執行落子
 */
async function handleMakeMove(
  request: Request,
  env: Env,
  t: Translations,
  ctx?: ExecutionContext
): Promise<Response> {
  try {
    const { gameId, position, player, userId } = (await request.json()) as {
      gameId: string;
      position: Position;
      player: 'black' | 'white';
      userId?: string;
    };

    // 從資料庫獲取遊戲狀態
    const gameData = await env.DB.prepare(
      `
      SELECT * FROM games WHERE id = ?1
    `
    )
      .bind(gameId)
      .first();

    if (!gameData) {
      return jsonResponse({ error: t.gameNotFound }, 404);
    }

    // 重構遊戲狀態
    const gameState: GameState = toGameState(gameData);

    // PVP 對局一律走 Durable Object 的 WebSocket，避免繞過房間的回合與身分檢查
    if (gameState.mode !== 'ai') {
      return jsonResponse({ error: '此對局請透過房間連線落子' }, 403);
    }

    // 落子者必須是這場對局中該顏色的擁有者
    const seatOwner = gameState.players[player];
    if (!userId || !seatOwner || seatOwner !== userId) {
      return jsonResponse({ error: '無權在此對局落子' }, 403);
    }

    const actor = await resolveActor(request, env, userId);
    if (!actor.ok) {
      return jsonResponse({ error: actor.reason }, 403);
    }

    // 執行落子
    const newGameState = GameLogic.makeMove(gameState, position, player);

    // 更新資料庫
    await env.DB.prepare(
      `
      UPDATE games 
      SET board_state = ?1, current_player = ?2, status = ?3, 
          winner = ?4, updated_at = ?5, moves = ?6
      WHERE id = ?7
    `
    )
      .bind(
        JSON.stringify(newGameState.board),
        newGameState.currentPlayer,
        newGameState.status,
        newGameState.winner,
        newGameState.updatedAt,
        JSON.stringify(newGameState.moves),
        gameId
      )
      .run();

    // 如果遊戲結束，保存 AI 對戰記錄
    if (newGameState.status === 'finished') {
      if (newGameState.mode === 'ai') {
        await saveAIGameRecord(newGameState, env);
      }

      // 向量寫入不影響回應，移出關鍵路徑
      ctx?.waitUntil(
        new VectorizeService(env)
          .storeGameState(newGameState)
          .catch(error => console.error('背景儲存棋局向量失敗:', error))
      );
    }

    return new Response(JSON.stringify({ gameState: newGameState }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('執行落子失敗:', error);
    return new Response(
      JSON.stringify({
        error: '落子失敗',
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

/**
 * AI 落子
 */
async function handleAIMove(
  request: Request,
  env: Env,
  t: Translations,
  ctx?: ExecutionContext
): Promise<Response> {
  try {
    const { gameId, difficulty, userId } = (await request.json()) as {
      gameId: string;
      difficulty?: 'easy' | 'medium' | 'hard';
      userId?: string;
    };

    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
      return jsonResponse({ error: '不支援的難度' }, 400);
    }

    // 獲取遊戲狀態
    const gameData = await env.DB.prepare(
      `
      SELECT * FROM games WHERE id = ?1
    `
    )
      .bind(gameId)
      .first();

    if (!gameData) {
      return jsonResponse({ error: t.gameNotFound }, 404);
    }

    const gameState: GameState = toGameState(gameData);

    // AI 運算成本高，必須確認是本人的 AI 對局、且確實輪到 AI，才允許觸發
    if (gameState.mode !== 'ai') {
      return jsonResponse({ error: '此對局不是 AI 模式' }, 403);
    }

    if (!userId || gameState.players.black !== userId) {
      return jsonResponse({ error: '無權操作此對局' }, 403);
    }

    const actor = await resolveActor(request, env, userId);
    if (!actor.ok) {
      return jsonResponse({ error: actor.reason }, 403);
    }

    if (gameState.status !== 'playing') {
      return jsonResponse({ error: '遊戲尚未開始或已結束' }, 409);
    }

    if (gameState.currentPlayer !== 'white') {
      return jsonResponse({ error: '目前不是 AI 的回合' }, 409);
    }

    // 生成 AI 落子（追蹤思考用時）
    const aiEngine = new AIEngine(env);
    const startTime = Date.now();
    const aiMove = await aiEngine.generateMove(gameState, difficulty);
    const thinkingTime = Date.now() - startTime;

    // 執行 AI 落子
    const newGameState = GameLogic.makeMove(
      gameState,
      aiMove.position,
      gameState.currentPlayer
    );

    // 更新資料庫
    await env.DB.prepare(
      `
      UPDATE games 
      SET board_state = ?1, current_player = ?2, status = ?3, 
          winner = ?4, updated_at = ?5, moves = ?6
      WHERE id = ?7
    `
    )
      .bind(
        JSON.stringify(newGameState.board),
        newGameState.currentPlayer,
        newGameState.status,
        newGameState.winner,
        newGameState.updatedAt,
        JSON.stringify(newGameState.moves),
        gameId
      )
      .run();

    // 如果遊戲結束，保存遊戲記錄
    if (newGameState.status === 'finished') {
      await saveAIGameRecord(newGameState, env);
    }

    // 向量寫入與講評都不影響這次回應，移出關鍵路徑以免拖慢落子
    ctx?.waitUntil(
      (async () => {
        try {
          await new VectorizeService(env).storeGameState(newGameState);
        } catch (error) {
          console.error('背景儲存棋局向量失敗:', error);
        }

        try {
          const commentary = await aiEngine.generateCommentary(
            newGameState,
            'white'
          );

          if (commentary) {
            await env.gomoku_admin.put(
              commentaryKey(gameId),
              JSON.stringify({
                moveCount: newGameState.moves.length,
                text: commentary,
                createdAt: Date.now(),
              }),
              { expirationTtl: COMMENTARY_TTL_SECONDS }
            );
          }
        } catch (error) {
          console.error('背景產生講評失敗:', error);
        }
      })()
    );

    return new Response(
      JSON.stringify({
        gameState: newGameState,
        aiMove: {
          position: aiMove.position,
          reasoning: aiMove.reasoning,
          confidence: aiMove.confidence,
          thinkingTime: thinkingTime,
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
    console.error('AI 落子失敗:', error);
    return new Response(
      JSON.stringify({
        error: 'AI 落子失敗',
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
 * 取得該對局最新的 AI 講評
 *
 * 講評是在落子回應送出後才於背景產生，因此前端拿到落子結果後
 * 需要稍後再來取一次；還沒好就回傳 null，由前端自行重試。
 */
async function handleGetCommentary(
  gameId: string,
  env: Env
): Promise<Response> {
  try {
    const stored = await env.gomoku_admin.get(commentaryKey(gameId));

    if (!stored) {
      return jsonResponse({ commentary: null });
    }

    return jsonResponse({ commentary: JSON.parse(stored) });
  } catch (error) {
    console.error('取得講評失敗:', error);
    return jsonResponse({ commentary: null });
  }
}

/**
 * 獲取遊戲狀態
 */
async function handleGetGameState(gameId: string, env: Env, t: Translations): Promise<Response> {
  try {
    const gameData = await env.DB.prepare(
      `
      SELECT * FROM games WHERE id = ?1
    `
    )
      .bind(gameId)
      .first();

    if (!gameData) {
      return jsonResponse({ error: t.gameNotFound }, 404);
    }

    const gameState: GameState = toGameState(gameData);

    return new Response(JSON.stringify({ gameState }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('獲取遊戲狀態失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取遊戲狀態失敗',
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

