/**
 * AI 自我訓練 API 處理器
 */

import { Env } from '../types';
import { corsHeaders } from '../utils/cors';
import { SelfTrainingService } from '../ai/SelfTrainingService';

/**
 * 開始AI自我訓練
 */
export async function handleStartAITraining(request: Request, env: Env): Promise<Response> {
  try {
    const { difficulty = 'medium' } = (await request.json()) as { difficulty?: 'easy' | 'medium' | 'hard' };
    
    console.log(`🚀 開始AI自我訓練 - 難度: ${difficulty}`);
    
    // 在後台啟動訓練，避免阻塞請求
    const trainingService = new SelfTrainingService(env);
    
    // 使用 setTimeout 讓訓練在後台執行
    setTimeout(async () => {
      try {
        const session = await trainingService.startTrainingSession(difficulty);
        console.log(`✅ AI自我訓練完成: ${session.id}`);
      } catch (error) {
        console.error('❌ AI自我訓練失敗:', error);
      }
    }, 0);
    
    return new Response(
      JSON.stringify({
        message: 'AI自我訓練已開始',
        difficulty,
        status: 'started',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('啟動AI自我訓練失敗:', error);
    return new Response(
      JSON.stringify({
        error: '啟動AI自我訓練失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
        timestamp: new Date().toISOString(),
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
 * 獲取AI訓練統計
 */
export async function handleGetTrainingStats(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    console.log(`📊 獲取AI訓練統計 - 會話ID: ${sessionId || 'all'}`);
    
    const trainingService = new SelfTrainingService(env);
    const stats = await trainingService.getTrainingStats(sessionId || undefined);
    
    return new Response(
      JSON.stringify({
        stats,
        count: stats.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('獲取AI訓練統計失敗:', error);
    return new Response(
      JSON.stringify({
        error: '獲取AI訓練統計失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
        timestamp: new Date().toISOString(),
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
