/**
 * 遊戲 API 處理器
 */

import { Env, GameState, Position } from '../types';
import { GameLogic } from '../game/GameLogic';
import { AIEngine } from '../ai/AIEngine';
import { VectorizeService } from '../ai/VectorizeService';
import { corsHeaders } from '../utils/cors';
import { saveAIGameRecord } from './gameRecord';

export async function handleGameAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/game', '');

  switch (request.method) {
    case 'POST':
      if (path === '/create') {
        return handleCreateGame(request, env);
      }
      if (path === '/move') {
        return handleMakeMove(request, env);
      }
      if (path === '/ai-move') {
        return handleAIMove(request, env);
      }
      break;

    case 'GET':
      if (path.startsWith('/state/')) {
        const gameId = path.replace('/state/', '');
        return handleGetGameState(gameId, env);
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
            `匿名玩家_${userId.slice(-6)}`,
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
        message: error instanceof Error ? error.message : '未知錯誤',
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
async function handleMakeMove(request: Request, env: Env): Promise<Response> {
  try {
    const { gameId, position, player } = (await request.json()) as {
      gameId: string;
      position: Position;
      player: 'black' | 'white';
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
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // 重構遊戲狀態
    const gameState: GameState = {
      id: gameData.id as string,
      board: JSON.parse(gameData.board_state as string),
      currentPlayer: gameData.current_player as 'black' | 'white',
      status: gameData.status as 'waiting' | 'playing' | 'finished',
      mode: gameData.mode as 'pvp' | 'ai',
      moves: gameData.moves ? JSON.parse(gameData.moves as string) : [],
      winner: gameData.winner as 'black' | 'white' | 'draw' | null,
      players: {
        black: (gameData.black_player_id as string) || undefined,
        white: (gameData.white_player_id as string) || undefined,
      },
      createdAt: gameData.created_at as number,
      updatedAt: gameData.updated_at as number,
    };

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

    // 如果遊戲結束，儲存到 Vectorize
    if (newGameState.status === 'finished') {
      const vectorizeService = new VectorizeService(env);
      await vectorizeService.storeGameState(newGameState);
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
        message: error instanceof Error ? error.message : '未知錯誤',
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
async function handleAIMove(request: Request, env: Env): Promise<Response> {
  try {
    const { gameId, difficulty } = (await request.json()) as {
      gameId: string;
      difficulty?: 'easy' | 'medium' | 'hard';
    };

    // 獲取遊戲狀態
    const gameData = await env.DB.prepare(
      `
      SELECT * FROM games WHERE id = ?1
    `
    )
      .bind(gameId)
      .first();

    if (!gameData) {
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const gameState: GameState = {
      id: gameData.id as string,
      board: JSON.parse(gameData.board_state as string),
      currentPlayer: gameData.current_player as 'black' | 'white',
      status: gameData.status as 'waiting' | 'playing' | 'finished',
      mode: gameData.mode as 'pvp' | 'ai',
      moves: gameData.moves ? JSON.parse(gameData.moves as string) : [],
      winner: gameData.winner as 'black' | 'white' | 'draw' | null,
      players: {
        black: (gameData.black_player_id as string) || undefined,
        white: (gameData.white_player_id as string) || undefined,
      },
      createdAt: gameData.created_at as number,
      updatedAt: gameData.updated_at as number,
    };

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

    // 儲存到 Vectorize（不返回分析）
    const vectorizeService = new VectorizeService(env);
    await vectorizeService.storeGameState(newGameState);

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
        message: error instanceof Error ? error.message : '未知錯誤',
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
 * 獲取遊戲狀態
 */
async function handleGetGameState(gameId: string, env: Env): Promise<Response> {
  try {
    const gameData = await env.DB.prepare(
      `
      SELECT * FROM games WHERE id = ?1
    `
    )
      .bind(gameId)
      .first();

    if (!gameData) {
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    const gameState: GameState = {
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
        message: error instanceof Error ? error.message : '未知錯誤',
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

