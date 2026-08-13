/**
 * AI 自我訓練 API 處理器
 */

import { Env } from '../types';
import { corsHeaders } from '../utils/cors';
import { SelfTrainingService } from '../ai/SelfTrainingService';

/**
 * 開始AI自我訓練
 */
export async function handleStartAITraining(
  request: Request,
  env: Env,
  ctx?: ExecutionContext
): Promise<Response> {
  try {
    const { difficulty = 'medium' } = (await request.json()) as { difficulty?: 'easy' | 'medium' | 'hard' };

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return new Response(JSON.stringify({ error: '不支援的難度' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`🚀 開始AI自我訓練 - 難度: ${difficulty}`);

    const trainingService = new SelfTrainingService(env);

    // 回應送出後 Worker 就會終止背景工作，setTimeout 排的訓練根本不會跑完，
    // 必須交給 waitUntil 才能在回應之後繼續執行
    const training = trainingService
      .startTrainingSession(difficulty)
      .then(session => console.log(`✅ AI自我訓練完成: ${session.id}`))
      .catch(error => console.error('❌ AI自我訓練失敗:', error));

    if (ctx) {
      ctx.waitUntil(training);
    } else {
      await training;
    }

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
