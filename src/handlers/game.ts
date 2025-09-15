/**
 * 遊戲 API 處理器
 */

import { Env, GameState, Position } from '../types';
import { GameLogic } from '../game/GameLogic';
import { AIEngine } from '../ai/AIEngine';
import { VectorizeService } from '../ai/VectorizeService';
import { corsHeaders } from '../utils/cors';

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
      if (path === '/analyze') {
        return handleAnalyzeGame(request, env);
      }
      break;

    case 'GET':
      if (path.startsWith('/state/')) {
        const gameId = path.replace('/state/', '');
        return handleGetGameState(gameId, env);
      }
      if (path === '/suggestions') {
        return handleGetSuggestions(request, env);
      }
      break;
  }

  return new Response('Not found', { 
    status: 404,
    headers: corsHeaders
  });
}

/**
 * 創建新遊戲
 */
async function handleCreateGame(request: Request, env: Env): Promise<Response> {
  try {
    const { mode, userId } = await request.json() as { 
      mode: 'pvp' | 'ai'; 
      userId?: string;
    };

    const gameId = crypto.randomUUID();
    const gameState = GameLogic.createGame(gameId, mode);

    // 如果是 AI 模式，設置玩家
    if (mode === 'ai' && userId) {
      // 先檢查用戶是否存在，如果不存在則創建匿名用戶
      const existingUser = await env.DB.prepare(`
        SELECT id FROM users WHERE id = ?1
      `).bind(userId).first();
      
      if (!existingUser) {
        // 創建匿名用戶
        await env.DB.prepare(`
          INSERT OR IGNORE INTO users (id, username, wins, losses, draws, rating, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        `).bind(
          userId,
          `匿名玩家_${userId.slice(-6)}`,
          0, 0, 0, 1200,
          Date.now(), Date.now()
        ).run();
      }
      
      gameState.players.black = userId;
      gameState.status = 'playing';
    }

    // 保存到資料庫
    await env.DB.prepare(`
      INSERT INTO games (
        id, board_state, current_player, status, mode, 
        black_player_id, white_player_id, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `).bind(
      gameState.id,
      JSON.stringify(gameState.board),
      gameState.currentPlayer,
      gameState.status,
      gameState.mode,
      gameState.players.black || null,
      gameState.players.white || null,
      gameState.createdAt,
      gameState.updatedAt
    ).run();

    return new Response(JSON.stringify({ gameState }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('創建遊戲失敗:', error);
    return new Response(JSON.stringify({ 
      error: '創建遊戲失敗',
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
 * 執行落子
 */
async function handleMakeMove(request: Request, env: Env): Promise<Response> {
  try {
    const { gameId, position, player } = await request.json() as {
      gameId: string;
      position: Position;
      player: 'black' | 'white';
    };

    // 從資料庫獲取遊戲狀態
    const gameData = await env.DB.prepare(`
      SELECT * FROM games WHERE id = ?1
    `).bind(gameId).first();

    if (!gameData) {
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 重構遊戲狀態
    const gameState: GameState = {
      id: gameData.id as string,
      board: JSON.parse(gameData.board_state as string),
      currentPlayer: gameData.current_player as 'black' | 'white',
      status: gameData.status as 'waiting' | 'playing' | 'finished',
      mode: gameData.mode as 'pvp' | 'ai',
      moves: [], // 需要從其他地方獲取或重新構建
      winner: gameData.winner as 'black' | 'white' | 'draw' | null,
      players: {
        black: gameData.black_player_id as string || undefined,
        white: gameData.white_player_id as string || undefined
      },
      createdAt: gameData.created_at as number,
      updatedAt: gameData.updated_at as number
    };

    // 執行落子
    const newGameState = GameLogic.makeMove(gameState, position, player);

    // 更新資料庫
    await env.DB.prepare(`
      UPDATE games 
      SET board_state = ?1, current_player = ?2, status = ?3, 
          winner = ?4, updated_at = ?5
      WHERE id = ?6
    `).bind(
      JSON.stringify(newGameState.board),
      newGameState.currentPlayer,
      newGameState.status,
      newGameState.winner,
      newGameState.updatedAt,
      gameId
    ).run();

    // 如果遊戲結束，儲存到 Vectorize
    if (newGameState.status === 'finished') {
      const vectorizeService = new VectorizeService(env);
      await vectorizeService.storeGameState(newGameState);
    }

    return new Response(JSON.stringify({ gameState: newGameState }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('執行落子失敗:', error);
    return new Response(JSON.stringify({ 
      error: '落子失敗',
      message: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * AI 落子
 */
async function handleAIMove(request: Request, env: Env): Promise<Response> {
  try {
    const { gameId, difficulty } = await request.json() as {
      gameId: string;
      difficulty?: 'easy' | 'medium' | 'hard';
    };

    // 獲取遊戲狀態
    const gameData = await env.DB.prepare(`
      SELECT * FROM games WHERE id = ?1
    `).bind(gameId).first();

    if (!gameData) {
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const gameState: GameState = {
      id: gameData.id as string,
      board: JSON.parse(gameData.board_state as string),
      currentPlayer: gameData.current_player as 'black' | 'white',
      status: gameData.status as 'waiting' | 'playing' | 'finished',
      mode: gameData.mode as 'pvp' | 'ai',
      moves: [],
      winner: gameData.winner as 'black' | 'white' | 'draw' | null,
      players: {
        black: gameData.black_player_id as string || undefined,
        white: gameData.white_player_id as string || undefined
      },
      createdAt: gameData.created_at as number,
      updatedAt: gameData.updated_at as number
    };

    // 生成 AI 落子
    const aiEngine = new AIEngine(env);
    const aiMove = await aiEngine.generateMove(gameState, difficulty);

    // 執行 AI 落子
    const newGameState = GameLogic.makeMove(
      gameState, 
      aiMove.position, 
      gameState.currentPlayer
    );

    // 更新資料庫
    await env.DB.prepare(`
      UPDATE games 
      SET board_state = ?1, current_player = ?2, status = ?3, 
          winner = ?4, updated_at = ?5
      WHERE id = ?6
    `).bind(
      JSON.stringify(newGameState.board),
      newGameState.currentPlayer,
      newGameState.status,
      newGameState.winner,
      newGameState.updatedAt,
      gameId
    ).run();

    // 分析局面並儲存到 Vectorize
    const vectorizeService = new VectorizeService(env);
    const analysis = await aiEngine.analyzeGameAdvantage(newGameState, gameState.currentPlayer);
    await vectorizeService.storeGameState(newGameState, analysis.advantage);

    return new Response(JSON.stringify({ 
      gameState: newGameState,
      aiMove: {
        position: aiMove.position,
        reasoning: aiMove.reasoning,
        confidence: aiMove.confidence
      },
      analysis
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('AI 落子失敗:', error);
    return new Response(JSON.stringify({ 
      error: 'AI 落子失敗',
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
 * 分析遊戲局面
 */
async function handleAnalyzeGame(request: Request, env: Env): Promise<Response> {
  try {
    const { gameId, player } = await request.json() as {
      gameId: string;
      player: 'black' | 'white';
    };

    // 獲取遊戲狀態
    const gameData = await env.DB.prepare(`
      SELECT * FROM games WHERE id = ?1
    `).bind(gameId).first();

    if (!gameData) {
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const gameState: GameState = {
      id: gameData.id as string,
      board: JSON.parse(gameData.board_state as string),
      currentPlayer: gameData.current_player as 'black' | 'white',
      status: gameData.status as 'waiting' | 'playing' | 'finished',
      mode: gameData.mode as 'pvp' | 'ai',
      moves: [],
      winner: gameData.winner as 'black' | 'white' | 'draw' | null,
      players: {
        black: gameData.black_player_id as string || undefined,
        white: gameData.white_player_id as string || undefined
      },
      createdAt: gameData.created_at as number,
      updatedAt: gameData.updated_at as number
    };

    // 使用 AI 分析局面
    const aiEngine = new AIEngine(env);
    const analysis = await aiEngine.analyzeGameAdvantage(gameState, player);

    // 獲取歷史建議
    const vectorizeService = new VectorizeService(env);
    const suggestions = await vectorizeService.getHistoricalMovesSuggestions(gameState);

    return new Response(JSON.stringify({ 
      analysis,
      suggestions
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('分析遊戲失敗:', error);
    return new Response(JSON.stringify({ 
      error: '分析遊戲失敗',
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
 * 獲取遊戲狀態
 */
async function handleGetGameState(gameId: string, env: Env): Promise<Response> {
  try {
    const gameData = await env.DB.prepare(`
      SELECT * FROM games WHERE id = ?1
    `).bind(gameId).first();

    if (!gameData) {
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const gameState: GameState = {
      id: gameData.id as string,
      board: JSON.parse(gameData.board_state as string),
      currentPlayer: gameData.current_player as 'black' | 'white',
      status: gameData.status as 'waiting' | 'playing' | 'finished',
      mode: gameData.mode as 'pvp' | 'ai',
      moves: [],
      winner: gameData.winner as 'black' | 'white' | 'draw' | null,
      roomCode: gameData.room_code as string || undefined,
      players: {
        black: gameData.black_player_id as string || undefined,
        white: gameData.white_player_id as string || undefined
      },
      createdAt: gameData.created_at as number,
      updatedAt: gameData.updated_at as number
    };

    return new Response(JSON.stringify({ gameState }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取遊戲狀態失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取遊戲狀態失敗',
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
 * 獲取走法建議
 */
async function handleGetSuggestions(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
      return new Response(JSON.stringify({ error: '缺少 gameId 參數' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 獲取遊戲狀態
    const gameData = await env.DB.prepare(`
      SELECT * FROM games WHERE id = ?1
    `).bind(gameId).first();

    if (!gameData) {
      return new Response(JSON.stringify({ error: '遊戲不存在' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const gameState: GameState = {
      id: gameData.id as string,
      board: JSON.parse(gameData.board_state as string),
      currentPlayer: gameData.current_player as 'black' | 'white',
      status: gameData.status as 'waiting' | 'playing' | 'finished',
      mode: gameData.mode as 'pvp' | 'ai',
      moves: [],
      winner: gameData.winner as 'black' | 'white' | 'draw' | null,
      players: {
        black: gameData.black_player_id as string || undefined,
        white: gameData.white_player_id as string || undefined
      },
      createdAt: gameData.created_at as number,
      updatedAt: gameData.updated_at as number
    };

    // 獲取歷史建議
    const vectorizeService = new VectorizeService(env);
    const suggestions = await vectorizeService.getHistoricalMovesSuggestions(gameState);

    return new Response(JSON.stringify(suggestions), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('獲取建議失敗:', error);
    return new Response(JSON.stringify({ 
      error: '獲取建議失敗',
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
