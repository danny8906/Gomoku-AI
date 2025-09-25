/**
 * 靜態資源處理器
 */

import { Env } from '../types';

export async function serveStaticAssets(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // 根據路徑返回對應的靜態資源
  switch (path) {
    case '/':
      return new Response(getIndexHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    
    case '/game':
      return new Response(getGameHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    
    case '/room':
      return new Response(getRoomHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    
    case '/profile':
      return new Response(getProfileHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    
    case '/leaderboard':
      return new Response(getLeaderboardHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    
    case '/app.js':
      return new Response(getAppJS(), {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
      });
    
    case '/styles.css':
      return new Response(getStylesCSS(), {
        headers: { 'Content-Type': 'text/css; charset=utf-8' }
      });
    
    
    default:
      return new Response('Not found', { status: 404 });
  }
}

function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniAI 五子棋 - Cloudflare Workers AI</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1><img src="/logo.png" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> OmniAI 五子棋</h1>
            <div class="header-right">
                <p id="user-greeting">載入中...</p>
                <button class="btn danger header-logout-btn" onclick="logout()" style="display: none;">登出</button>
            </div>
        </header>
        
        <main class="main">
            <div class="welcome-section">
                <h2>歡迎來到五子棋世界</h2>
                <p>體驗由 Cloudflare Workers AI 驅動的智能對戰</p>
                
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3>🤖 AI 對戰</h3>
                        <p>與智能 AI 對戰，提升棋藝</p>
                        <div class="ai-difficulty-home">
                            <label for="home-ai-difficulty">選擇難度：</label>
                            <select id="home-ai-difficulty">
                                <option value="easy">簡單</option>
                                <option value="medium" selected>中等</option>
                                <option value="hard">困難</option>
                            </select>
                        </div>
                        <button class="btn primary" onclick="startAIGame()">開始 AI 對戰</button>
                    </div>
                    
                    <div class="feature-card">
                        <h3>👥 玩家對戰</h3>
                        <p>與朋友即時對戰</p>
                        <button class="btn primary" onclick="showRoomOptions()">玩家對戰</button>
                    </div>
                    
                    <div class="feature-card">
                        <h3>📊 排行榜</h3>
                        <p>查看全球排名</p>
                        <button class="btn secondary" onclick="window.location.href='/leaderboard'">查看排行榜</button>
                    </div>
                    
                    <div class="feature-card" id="profile-card">
                        <h3>👤 個人資料</h3>
                        <div id="profile-content">
                            <p id="profile-description">管理帳號和戰績</p>
                            <button class="btn secondary" id="profile-button" onclick="showLoginModal()">登入/註冊</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="room-options" class="modal" style="display: none;">
                <div class="modal-content">
                    <span class="close" onclick="hideRoomOptions()">&times;</span>
                    <h3>玩家對戰選項</h3>
                    <div class="room-buttons">
                        <button class="btn primary" onclick="createRoom()">創建房間</button>
                        <button class="btn secondary" onclick="showJoinRoom()">加入房間</button>
                    </div>
                    <div id="join-room" class="join-room-container" style="display: none;">
                        <div class="room-input-group">
                            <input type="text" id="roomCode" class="room-code-input" placeholder="輸入房間代碼" maxlength="4">
                            <button class="btn primary room-join-btn" onclick="joinRoom()">
                                <span>🚪</span> 加入房間
                            </button>
                        </div>
                        <div class="room-code-hint">
                            <p>💡 房間代碼為4位英文字母</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="login-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <span class="close" onclick="hideLoginModal()">&times;</span>
                    <h3 id="auth-title">登入</h3>
                    <form id="auth-form">
                        <input type="text" id="username" placeholder="用戶名" required>
                        <input type="email" id="email" placeholder="電子郵件 (註冊時需要)" style="display: none;">
                        <input type="password" id="password" placeholder="密碼" required>
                        <button type="submit" class="btn primary">登入</button>
                    </form>
                    <p>
                        <span id="auth-switch-text">還沒有帳號？</span>
                        <a href="#" id="auth-switch" onclick="toggleAuthMode()">註冊</a>
                    </p>
                </div>
            </div>
            
            <div id="change-password-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <span class="close" onclick="hideChangePasswordModal()">&times;</span>
                    <h3>更改密碼</h3>
                    <form id="change-password-form">
                        <input type="password" id="current-password" placeholder="當前密碼" required>
                        <input type="password" id="new-password" placeholder="新密碼" required>
                        <input type="password" id="confirm-password" placeholder="確認新密碼" required>
                        <button type="submit" class="btn primary">更改密碼</button>
                    </form>
                </div>
            </div>
        </main>
        
        <footer class="footer">
            <p>&copy; 2024 OmniAI 五子棋 - 由 Cloudflare Workers AI 驅動</p>
        </footer>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getGameHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>遊戲中 - OmniAI 五子棋</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1><img src="/logo.png" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> OmniAI 五子棋</h1>
            <div class="game-info">
                <span id="game-mode">AI 對戰</span>
                <span id="current-player">黑棋回合</span>
                <span id="game-status">遊戲進行中</span>
            </div>
        </header>
        
        <main class="game-main">
            <div class="game-container">
                <div class="game-board-container">
                    <canvas id="game-board" width="600" height="600"></canvas>
                    <div id="game-controls">
                        <button class="btn secondary" onclick="window.location.href='/'">返回首頁</button>
                        <button class="btn primary" onclick="restartGame()">重新開始</button>
                        <button class="btn secondary" onclick="analyzePosition()">分析局面</button>
                        
                        <!-- AI 難度選擇器 -->
                        <div class="difficulty-selector" id="difficulty-selector" style="display: none;">
                            <label for="ai-difficulty">AI 難度：</label>
                            <select id="ai-difficulty" onchange="changeDifficulty()">
                                <option value="easy">簡單 (30% 次優解)</option>
                                <option value="medium" selected>中等 (10% 次優解)</option>
                                <option value="hard">困難 (總是最優解)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="game-sidebar">
                    <div class="player-info">
                        <div class="player black">
                            <div class="player-piece"></div>
                            <span>黑棋</span>
                            <span id="black-player-name">玩家</span>
                        </div>
                        <div class="player white">
                            <div class="player-piece"></div>
                            <span>白棋</span>
                            <span id="white-player-name">AI</span>
                        </div>
                    </div>
                    
                    <div class="move-history">
                        <h4>走法記錄</h4>
                        <div id="moves-list"></div>
                    </div>
                    
                    <div class="ai-analysis" id="ai-analysis" style="display: none;">
                        <h4>AI 分析</h4>
                        <div id="analysis-content"></div>
                    </div>
                    
                    <div class="suggestions" id="suggestions" style="display: none;">
                        <h4>歷史建議</h4>
                        <div id="suggestions-content"></div>
                    </div>
                </div>
            </div>
        </main>
        
        <!-- 遊戲結束彈窗 -->
        <div id="game-over-modal" class="modal" style="display: none;">
            <div class="modal-content game-over-content">
                <div class="game-result">
                    <h2 id="game-result-title">遊戲結束</h2>
                    <div id="game-result-icon">🎉</div>
                    <p id="game-result-message">恭喜獲勝！</p>
                    <div id="game-stats">
                        <p id="game-duration">遊戲時長: --</p>
                        <p id="total-moves">總步數: --</p>
                    </div>
                </div>
                <div class="game-over-buttons">
                    <button class="btn primary" id="restart-btn">
                        <span>🔄</span> 重新開始
                    </button>
                    <button class="btn secondary" id="home-btn">
                        <span>🏠</span> 返回首頁
                    </button>
                    <button class="btn secondary" id="analyze-btn">
                        <span>📊</span> 分析棋局
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getRoomHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>房間 - OmniAI 五子棋</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1>♟️ OmniAI 五子棋房間</h1>
            <div class="room-info">
                <span id="room-code">房間代碼: ----</span>
                <span id="player-count">玩家: 0/2</span>
            </div>
        </header>
        
        <main class="game-main">
            <div class="room-container">
                <div class="waiting-area" id="waiting-area">
                    <h2>等待玩家加入...</h2>
                    <p>分享房間代碼給朋友：<strong id="share-code">----</strong></p>
                    <div class="loading">⏳</div>
                </div>
                
                <div class="game-area" id="game-area" style="display: none;">
                    <div class="game-board-container">
                        <canvas id="game-board" width="600" height="600"></canvas>
                        <div id="game-controls">
                            <button class="btn secondary" onclick="leaveRoom()">離開房間</button>
                            <button class="btn primary" onclick="restartGame()" style="display: none;">重新開始</button>
                        </div>
                    </div>
                    
                    <div class="room-sidebar">
                        <div class="player-info">
                            <div class="player black">
                                <div class="player-piece"></div>
                                <span>黑棋</span>
                                <span id="black-player">等待中...</span>
                            </div>
                            <div class="player white">
                                <div class="player-piece"></div>
                                <span>白棋</span>
                                <span id="white-player">等待中...</span>
                            </div>
                        </div>
                        
                        <div class="chat-area">
                            <h4>聊天室</h4>
                            <div id="chat-messages"></div>
                            <div class="chat-input">
                                <input type="text" id="chat-input" placeholder="輸入訊息..." maxlength="200">
                                <button onclick="sendMessage()">發送</button>
                            </div>
                        </div>
                        
                        <div class="move-history">
                            <h4>走法記錄</h4>
                            <div id="moves-list"></div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        
        <!-- 遊戲結束彈窗 -->
        <div id="game-over-modal" class="modal" style="display: none;">
            <div class="modal-content game-over-content">
                <div class="game-result">
                    <h2 id="game-result-title">遊戲結束</h2>
                    <div id="game-result-icon">🎉</div>
                    <p id="game-result-message">恭喜獲勝！</p>
                    <div id="game-stats">
                        <p id="game-duration">遊戲時長: --</p>
                        <p id="total-moves">總步數: --</p>
                    </div>
                </div>
                <div class="game-over-buttons">
                    <button class="btn primary" id="restart-btn">
                        <span>🔄</span> 重新開始
                    </button>
                    <button class="btn secondary" id="home-btn">
                        <span>🏠</span> 返回首頁
                    </button>
                    <button class="btn secondary" id="leave-btn">
                        <span>🚪</span> 離開房間
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getProfileHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>個人資料 - OmniAI 五子棋</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1>👤 個人資料</h1>
            <div class="profile-actions">
                <button class="btn secondary" onclick="window.location.href='/'">返回首頁</button>
                <button class="btn danger" onclick="logout()">登出</button>
            </div>
        </header>
        
        <main class="profile-main">
            <div class="profile-container">
                <div class="profile-card">
                    <div class="profile-header">
                        <h2 id="username">載入中...</h2>
                        <div class="rating">
                            <span>評分：</span>
                            <strong id="rating">1200</strong>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h3 id="wins">0</h3>
                            <p>勝利</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="losses">0</h3>
                            <p>失敗</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="draws">0</h3>
                            <p>平局</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="win-rate">0%</h3>
                            <p>勝率</p>
                        </div>
                    </div>
                </div>
                
                <div class="history-section">
                    <h3>最近對局</h3>
                    <div id="game-history" class="history-list">
                        載入中...
                    </div>
                </div>
                
                <div class="rating-chart">
                    <h3>評分變化</h3>
                    <canvas id="rating-chart" width="600" height="200"></canvas>
                </div>
            </div>
        </main>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getLeaderboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>排行榜 - OmniAI 五子棋</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1>🏆 排行榜</h1>
            <button class="btn secondary" onclick="window.location.href='/'">返回首頁</button>
        </header>
        
        <main class="leaderboard-main">
            <div class="leaderboard-container">
                <div class="search-section">
                    <input type="text" id="search-input" placeholder="搜索玩家..." onkeyup="searchPlayers()">
                </div>
                
                <div class="leaderboard-table">
                    <table>
                        <thead>
                            <tr>
                                <th>排名</th>
                                <th>玩家</th>
                                <th>評分</th>
                                <th>勝利</th>
                                <th>失敗</th>
                                <th>勝率</th>
                            </tr>
                        </thead>
                        <tbody id="leaderboard-body">
                            <tr>
                                <td colspan="6">載入中...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getStylesCSS(): string {
  return `/* OmniAI 五子棋樣式 - 統一設計系統 */

/* ===== CSS 變數系統 ===== */
:root {
    /* 顏色系統 */
    --color-primary: #4299e1;
    --color-primary-hover: #3182ce;
    --color-primary-light: #90cdf4;
    --color-primary-dark: #2b6cb0;
    
    --color-secondary: #718096;
    --color-secondary-hover: #4a5568;
    --color-secondary-light: #a0aec0;
    
    --color-success: #38a169;
    --color-warning: #d69e2e;
    --color-danger: #e53e3e;
    --color-info: #3182ce;
    
    --color-background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --color-surface: rgba(255, 255, 255, 0.95);
    --color-surface-hover: rgba(255, 255, 255, 0.98);
    --color-text-primary: #2d3748;
    --color-text-secondary: #718096;
    --color-text-muted: #a0aec0;
    --color-text-white: #ffffff;
    
    --color-border: #e2e8f0;
    --color-border-hover: #cbd5e0;
    --color-border-focus: var(--color-primary);
    
    --color-shadow: rgba(0, 0, 0, 0.1);
    --color-shadow-hover: rgba(0, 0, 0, 0.15);
    --color-shadow-focus: rgba(66, 153, 225, 0.1);
    
    /* 字體系統 */
    --font-family-primary: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;
    --font-size-3xl: 1.875rem;
    --font-size-4xl: 2.25rem;
    --font-size-5xl: 3rem;
    
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;
    
    --line-height-tight: 1.25;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.75;
    
    /* 間距系統 */
    --spacing-1: 0.25rem;
    --spacing-2: 0.5rem;
    --spacing-3: 0.75rem;
    --spacing-4: 1rem;
    --spacing-5: 1.25rem;
    --spacing-6: 1.5rem;
    --spacing-8: 2rem;
    --spacing-10: 2.5rem;
    --spacing-12: 3rem;
    --spacing-16: 4rem;
    --spacing-20: 5rem;
    
    /* 圓角系統 */
    --radius-xs: 0.25rem;
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --radius-2xl: 1.5rem;
    --radius-3xl: 2rem;
    --radius-4xl: 2.5rem;
    --radius-full: 9999px;
    
    /* 陰影系統 */
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    
    /* 動畫系統 */
    --transition-fast: 0.15s ease;
    --transition-normal: 0.3s ease;
    --transition-slow: 0.5s ease;
    
    /* 斷點系統 */
    --breakpoint-sm: 640px;
    --breakpoint-md: 768px;
    --breakpoint-lg: 1024px;
    --breakpoint-xl: 1280px;
    --breakpoint-2xl: 1536px;
}

/* ===== 基礎樣式重置 ===== */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

*::before,
*::after {
    box-sizing: border-box;
}

body {
    font-family: var(--font-family-primary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-normal);
    line-height: var(--line-height-normal);
    background: var(--color-background);
    min-height: 100vh;
    color: var(--color-text-primary);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* ===== 組件樣式 ===== */

/* 標題組件 */
.header {
    background: var(--color-surface);
    backdrop-filter: blur(10px);
    padding: var(--spacing-4) var(--spacing-8);
    box-shadow: var(--shadow-lg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0 0 var(--radius-2xl) var(--radius-2xl);
    margin: var(--spacing-4) var(--spacing-4) 0 var(--spacing-4);
}

.header h1 {
    color: var(--color-text-primary);
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-bold);
    line-height: var(--line-height-tight);
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
}

.header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
}

.header-logout-btn {
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-size-sm);
    white-space: nowrap;
}

.game-info, .room-info {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.game-info span, .room-info span {
    background: #4299e1;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
}

/* ===== 佈局系統 ===== */

/* 容器 */
.container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-4);
}

.container-sm {
    max-width: 640px;
}

.container-md {
    max-width: 768px;
}

.container-lg {
    max-width: 1024px;
}

.container-xl {
    max-width: 1280px;
}

.container-2xl {
    max-width: 1536px;
}

/* 主要內容區域 */
.main {
    padding: var(--spacing-8);
    max-width: 1200px;
    margin: 0 auto;
}

/* 網格系統 */
.grid {
    display: grid;
    gap: var(--spacing-6);
}

.grid-cols-1 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
}

.grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grid-cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid-cols-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
}

.grid-auto-fit {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.grid-auto-fill {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

/* 彈性佈局 */
.flex {
    display: flex;
}

.flex-col {
    flex-direction: column;
}

.flex-row {
    flex-direction: row;
}

.flex-wrap {
    flex-wrap: wrap;
}

.items-center {
    align-items: center;
}

.items-start {
    align-items: flex-start;
}

.items-end {
    align-items: flex-end;
}

.justify-center {
    justify-content: center;
}

.justify-between {
    justify-content: space-between;
}

.justify-around {
    justify-content: space-around;
}

.justify-evenly {
    justify-content: space-evenly;
}

/* 間距工具類 */
.gap-1 { gap: var(--spacing-1); }
.gap-2 { gap: var(--spacing-2); }
.gap-3 { gap: var(--spacing-3); }
.gap-4 { gap: var(--spacing-4); }
.gap-6 { gap: var(--spacing-6); }
.gap-8 { gap: var(--spacing-8); }

/* 歡迎區域 */
.welcome-section {
    text-align: center;
    margin-bottom: var(--spacing-12);
    padding: var(--spacing-8) 0;
}

.welcome-section h2 {
    color: var(--color-text-white);
    font-size: var(--font-size-5xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--spacing-4);
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    line-height: var(--line-height-tight);
}

.welcome-section p {
    color: rgba(255, 255, 255, 0.9);
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-8);
    line-height: var(--line-height-relaxed);
}

/* 功能網格 */
.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-8);
    margin-top: var(--spacing-8);
    padding: var(--spacing-4);
}

/* 卡片容器增強 */
.feature-grid .feature-card {
    position: relative;
    overflow: hidden;
}

.feature-grid .feature-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.1) 0%, 
        rgba(255, 255, 255, 0.05) 50%, 
        rgba(255, 255, 255, 0.1) 100%);
    opacity: 0;
    transition: opacity var(--transition-normal);
    pointer-events: none;
}

.feature-grid .feature-card:hover::after {
    opacity: 1;
}

/* 卡片組件 */
.card {
    background: var(--color-surface);
    padding: var(--spacing-8);
    border-radius: var(--radius-3xl);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all var(--transition-normal);
    border: 2px solid var(--color-border);
    position: relative;
    overflow: hidden;
}

.card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
    opacity: 0;
    transition: opacity var(--transition-normal);
}

.card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.1);
    border-color: var(--color-primary-light);
}

.card:hover::before {
    opacity: 1;
}

.card-header {
    margin-bottom: var(--spacing-6);
    position: relative;
    z-index: 1;
}

.card-title {
    color: var(--color-text-primary);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--spacing-4);
    line-height: var(--line-height-tight);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.card-description {
    color: var(--color-text-secondary);
    font-size: var(--font-size-lg);
    line-height: var(--line-height-relaxed);
    margin-bottom: var(--spacing-6);
    font-weight: var(--font-weight-medium);
}

.card-content {
    flex: 1;
    position: relative;
    z-index: 1;
}

.card-footer {
    margin-top: var(--spacing-6);
    padding-top: var(--spacing-4);
    border-top: 2px solid var(--color-border);
    position: relative;
    z-index: 1;
}

/* 功能卡片變體 */
.feature-card {
    text-align: center;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 280px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-3xl);
}

.feature-card:hover {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%);
    border-color: var(--color-primary);
}

.feature-card h3 {
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-4);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
}

.feature-card p {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-6);
    line-height: var(--line-height-relaxed);
    flex: 1;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-medium);
}

/* 卡片圖標樣式 */
.feature-card h3::before {
    font-size: var(--font-size-3xl);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

/* 特殊卡片樣式 */
.feature-card:nth-child(1) {
    border-left: 4px solid var(--color-primary);
}

.feature-card:nth-child(2) {
    border-left: 4px solid var(--color-success);
}

.feature-card:nth-child(3) {
    border-left: 4px solid var(--color-info);
}

.feature-card:nth-child(4) {
    border-left: 4px solid var(--color-warning);
}


/* 個人資料卡片樣式 */
#profile-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-4);
    background: rgba(255, 255, 255, 0.1);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(5px);
}

.user-stats {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    text-align: center;
    background: rgba(255, 255, 255, 0.2);
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.3);
}

.user-stats p {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.user-stats strong {
    color: var(--color-primary);
    font-weight: var(--font-weight-bold);
}

#profile-button {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    align-items: center;
    width: 100%;
}

#profile-button .btn {
    white-space: nowrap;
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-size-sm);
    min-width: 120px;
    width: 100%;
    font-weight: var(--font-weight-semibold);
}

/* 按鈕組件 */
.btn {
    padding: var(--spacing-3) var(--spacing-8);
    border: none;
    border-radius: var(--radius-2xl);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all var(--transition-normal);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    white-space: nowrap;
    min-width: fit-content;
    position: relative;
    overflow: hidden;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-shadow-focus);
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
}

/* 主要按鈕 */
.btn.primary {
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: var(--color-text-white);
    box-shadow: var(--shadow-md);
}

.btn.primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    background: linear-gradient(135deg, var(--color-primary-hover), var(--color-primary-dark));
}

/* 次要按鈕 */
.btn.secondary {
    background: var(--color-surface);
    color: var(--color-text-primary);
    border: 2px solid var(--color-border);
}

.btn.secondary:hover:not(:disabled) {
    background: var(--color-surface-hover);
    border-color: var(--color-border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

/* 危險按鈕 */
.btn.danger {
    background: var(--color-danger);
    color: var(--color-text-white);
    box-shadow: var(--shadow-md);
}

.btn.danger:hover:not(:disabled) {
    background: #c53030;
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

/* 按鈕尺寸變體 */
.btn.sm {
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-size-sm);
}

.btn.lg {
    padding: var(--spacing-4) var(--spacing-10);
    font-size: var(--font-size-lg);
}

/* 按鈕載入狀態 */
.btn.loading {
    position: relative;
    color: transparent;
}

.btn.loading::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    top: 50%;
    left: 50%;
    margin-left: -8px;
    margin-top: -8px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* 模態框組件 */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    animation: modalFadeIn var(--transition-normal);
}

@keyframes modalFadeIn {
    from {
        opacity: 0;
        backdrop-filter: blur(0px);
    }
    to {
        opacity: 1;
        backdrop-filter: blur(4px);
    }
}

.modal-content {
    background: var(--color-surface);
    padding: var(--spacing-8);
    border-radius: var(--radius-4xl);
    box-shadow: var(--shadow-2xl);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    animation: modalSlideIn var(--transition-normal);
    border: 1px solid var(--color-border);
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-6);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
}

.modal-title {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin: 0;
}

.close {
    position: absolute;
    top: var(--spacing-4);
    right: var(--spacing-6);
    font-size: var(--font-size-3xl);
    cursor: pointer;
    color: var(--color-text-muted);
    background: none;
    border: none;
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
}

.close:hover {
    color: var(--color-text-primary);
    background: var(--color-border);
}

.close:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-shadow-focus);
}

.game-main {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
}

.game-container {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 2rem;
    align-items: start;
}

.game-board-container {
    background: rgba(255, 255, 255, 0.95);
    padding: 2rem;
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    text-align: center;
}

#game-board {
    border: 2px solid #4a5568;
    border-radius: 10px;
    cursor: crosshair;
    background: #f7fafc;
}

.game-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.player-info {
    background: rgba(255, 255, 255, 0.95);
    padding: 1.5rem;
    border-radius: 15px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.player {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin: 0.5rem 0;
    border-radius: 10px;
    background: #f7fafc;
}

.player.active {
    background: #e6fffa;
    border: 2px solid #38b2ac;
}

.player-piece {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid #4a5568;
}

.player.black .player-piece {
    background: #2d3748;
}

.player.white .player-piece {
    background: white;
}

.move-history, .ai-analysis, .suggestions {
    background: rgba(255, 255, 255, 0.95);
    padding: 1.5rem;
    border-radius: 15px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

#game-controls {
    margin-top: 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    align-items: center;
}

.difficulty-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 10px;
    backdrop-filter: blur(5px);
}

.difficulty-selector label {
    color: #4a5568;
    font-weight: 600;
    font-size: 0.9rem;
}

.difficulty-selector select {
    padding: 0.5rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    color: #4a5568;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
}

.difficulty-selector select:hover {
    border-color: #4299e1;
}

.difficulty-selector select:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

/* 卡片內表單樣式 */
.ai-difficulty-home {
    margin: var(--spacing-6) 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    align-items: center;
    background: rgba(255, 255, 255, 0.5);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(5px);
}

.ai-difficulty-home label {
    color: var(--color-text-primary);
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.ai-difficulty-home select {
    padding: var(--spacing-3) var(--spacing-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-normal);
    min-width: 140px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ai-difficulty-home select:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(66, 153, 225, 0.2);
    transform: translateY(-1px);
}

.ai-difficulty-home select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-shadow-focus), 0 4px 12px rgba(66, 153, 225, 0.2);
}

.move-history h4, .ai-analysis h4, .suggestions h4 {
    margin-bottom: 1rem;
    color: #4a5568;
}

#moves-list {
    max-height: 200px;
    overflow-y: auto;
}

.move-item {
    padding: 0.5rem;
    margin: 0.25rem 0;
    background: #f7fafc;
    border-radius: 5px;
    font-size: 0.9rem;
}

.footer {
    text-align: center;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 3rem;
}

/* ===== 響應式設計 ===== */

/* 小螢幕 (手機) */
@media (max-width: 640px) {
    .container {
        padding: 0 var(--spacing-3);
    }
    
    .main {
        padding: var(--spacing-4);
    }
    
    .header {
        flex-direction: column;
        gap: var(--spacing-4);
        padding: var(--spacing-4);
    }
    
    .header h1 {
        font-size: var(--font-size-2xl);
    }
    
    .welcome-section h2 {
        font-size: var(--font-size-3xl);
    }
    
    .welcome-section p {
        font-size: var(--font-size-lg);
    }
    
    .feature-grid {
        grid-template-columns: 1fr;
        gap: var(--spacing-4);
    }
    
    .game-container {
        grid-template-columns: 1fr;
        gap: var(--spacing-4);
    }
    
    #game-board {
        width: 100%;
        height: auto;
        max-width: 400px;
    }
    
    .modal-content {
        margin: var(--spacing-4);
        padding: var(--spacing-6);
    }
    
    .btn {
        padding: var(--spacing-3) var(--spacing-6);
        font-size: var(--font-size-sm);
    }
}

/* 中等螢幕 (平板) */
@media (min-width: 641px) and (max-width: 768px) {
    .feature-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .game-container {
        grid-template-columns: 1fr 250px;
    }
}

/* 大螢幕 (桌面) */
@media (min-width: 1024px) {
    .feature-grid {
        grid-template-columns: repeat(3, 1fr);
    }
    
    .game-container {
        grid-template-columns: 1fr 300px;
    }
}

/* 超大螢幕 */
@media (min-width: 1280px) {
    .feature-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}

/* ===== 工具類樣式 ===== */

/* 文字樣式 */
.text-xs { font-size: var(--font-size-xs); }
.text-sm { font-size: var(--font-size-sm); }
.text-base { font-size: var(--font-size-base); }
.text-lg { font-size: var(--font-size-lg); }
.text-xl { font-size: var(--font-size-xl); }
.text-2xl { font-size: var(--font-size-2xl); }
.text-3xl { font-size: var(--font-size-3xl); }
.text-4xl { font-size: var(--font-size-4xl); }
.text-5xl { font-size: var(--font-size-5xl); }

.font-normal { font-weight: var(--font-weight-normal); }
.font-medium { font-weight: var(--font-weight-medium); }
.font-semibold { font-weight: var(--font-weight-semibold); }
.font-bold { font-weight: var(--font-weight-bold); }

.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.text-primary { color: var(--color-text-primary); }
.text-secondary { color: var(--color-text-secondary); }
.text-muted { color: var(--color-text-muted); }
.text-white { color: var(--color-text-white); }
.text-success { color: var(--color-success); }
.text-warning { color: var(--color-warning); }
.text-danger { color: var(--color-danger); }
.text-info { color: var(--color-info); }

/* 背景樣式 */
.bg-primary { background-color: var(--color-primary); }
.bg-secondary { background-color: var(--color-secondary); }
.bg-success { background-color: var(--color-success); }
.bg-warning { background-color: var(--color-warning); }
.bg-danger { background-color: var(--color-danger); }
.bg-info { background-color: var(--color-info); }
.bg-surface { background-color: var(--color-surface); }

/* 邊框樣式 */
.border { border: 1px solid var(--color-border); }
.border-2 { border: 2px solid var(--color-border); }
.border-primary { border-color: var(--color-primary); }
.border-success { border-color: var(--color-success); }
.border-warning { border-color: var(--color-warning); }
.border-danger { border-color: var(--color-danger); }

/* 圓角樣式 */
.rounded-xs { border-radius: var(--radius-xs); }
.rounded-sm { border-radius: var(--radius-sm); }
.rounded { border-radius: var(--radius-md); }
.rounded-md { border-radius: var(--radius-md); }
.rounded-lg { border-radius: var(--radius-lg); }
.rounded-xl { border-radius: var(--radius-xl); }
.rounded-2xl { border-radius: var(--radius-2xl); }
.rounded-3xl { border-radius: var(--radius-3xl); }
.rounded-4xl { border-radius: var(--radius-4xl); }
.rounded-full { border-radius: var(--radius-full); }

/* 陰影樣式 */
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }
.shadow-xl { box-shadow: var(--shadow-xl); }
.shadow-2xl { box-shadow: var(--shadow-2xl); }
.shadow-none { box-shadow: none; }

/* 間距樣式 */
.p-1 { padding: var(--spacing-1); }
.p-2 { padding: var(--spacing-2); }
.p-3 { padding: var(--spacing-3); }
.p-4 { padding: var(--spacing-4); }
.p-6 { padding: var(--spacing-6); }
.p-8 { padding: var(--spacing-8); }

.px-1 { padding-left: var(--spacing-1); padding-right: var(--spacing-1); }
.px-2 { padding-left: var(--spacing-2); padding-right: var(--spacing-2); }
.px-3 { padding-left: var(--spacing-3); padding-right: var(--spacing-3); }
.px-4 { padding-left: var(--spacing-4); padding-right: var(--spacing-4); }
.px-6 { padding-left: var(--spacing-6); padding-right: var(--spacing-6); }
.px-8 { padding-left: var(--spacing-8); padding-right: var(--spacing-8); }

.py-1 { padding-top: var(--spacing-1); padding-bottom: var(--spacing-1); }
.py-2 { padding-top: var(--spacing-2); padding-bottom: var(--spacing-2); }
.py-3 { padding-top: var(--spacing-3); padding-bottom: var(--spacing-3); }
.py-4 { padding-top: var(--spacing-4); padding-bottom: var(--spacing-4); }
.py-6 { padding-top: var(--spacing-6); padding-bottom: var(--spacing-6); }
.py-8 { padding-top: var(--spacing-8); padding-bottom: var(--spacing-8); }

.m-1 { margin: var(--spacing-1); }
.m-2 { margin: var(--spacing-2); }
.m-3 { margin: var(--spacing-3); }
.m-4 { margin: var(--spacing-4); }
.m-6 { margin: var(--spacing-6); }
.m-8 { margin: var(--spacing-8); }

.mx-auto { margin-left: auto; margin-right: auto; }
.my-auto { margin-top: auto; margin-bottom: auto; }

/* 顯示樣式 */
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.grid { display: grid; }
.hidden { display: none; }

/* 位置樣式 */
.relative { position: relative; }
.absolute { position: absolute; }
.fixed { position: fixed; }
.sticky { position: sticky; }

/* 寬度和高度 */
.w-full { width: 100%; }
.h-full { height: 100%; }
.w-auto { width: auto; }
.h-auto { height: auto; }

/* 載入動畫 */
.loading {
    font-size: var(--font-size-3xl);
    animation: pulse 2s infinite;
    color: var(--color-text-muted);
}

@keyframes pulse {
    0%, 100% { 
        opacity: 1; 
        transform: scale(1);
    }
    50% { 
        opacity: 0.5; 
        transform: scale(1.1);
    }
}

/* 淡入動畫 */
.fade-in {
    animation: fadeIn var(--transition-normal);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* 滑入動畫 */
.slide-up {
    animation: slideUp var(--transition-normal);
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 旋轉動畫 */
.rotate {
    animation: rotate 1s linear infinite;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* 遊戲結束彈窗樣式 */
.game-over-content {
    max-width: 500px;
    width: 90%;
    text-align: center;
    padding: 3rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 20px;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
    border: none;
}

.game-result h2 {
    margin-bottom: 1rem;
    font-size: 2.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.game-result #game-result-icon {
    font-size: 4rem;
    margin: 1rem 0;
    animation: bounce 1s infinite;
}

@keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
        transform: translateY(0);
    }
    40% {
        transform: translateY(-10px);
    }
    60% {
        transform: translateY(-5px);
    }
}

.game-result p {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

#game-stats {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 1rem;
    margin: 1.5rem 0;
    backdrop-filter: blur(10px);
}

#game-stats p {
    margin: 0.5rem 0;
    font-size: 1rem;
    opacity: 0.9;
}

.game-over-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 2rem;
}

.game-over-buttons .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 120px;
    padding: 1rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 15px;
    transition: all 0.3s ease;
    text-decoration: none;
    border: none;
    cursor: pointer;
    position: relative;
    z-index: 10; /* 確保按鈕在最上層 */
}

.game-over-buttons .btn.primary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
}

.game-over-buttons .btn.primary:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
}

.game-over-buttons .btn.secondary {
    background: rgba(0, 0, 0, 0.2);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.2);
}

.game-over-buttons .btn.secondary:hover {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
}

/* 勝利特效 */
.winner-effect {
    position: relative;
    overflow: hidden;
}

.winner-effect::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent, rgba(255, 215, 0, 0.3), transparent);
    animation: shine 2s infinite;
    z-index: -1; /* 確保特效在按鈕下方 */
    pointer-events: none; /* 確保特效不會阻擋點擊 */
}

@keyframes shine {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

/* 表單組件 */
.form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
}

.form-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
}

.form-input {
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-2xl);
    font-size: var(--font-size-base);
    font-family: inherit;
    transition: all var(--transition-fast);
    background: var(--color-surface);
    color: var(--color-text-primary);
}

.form-input:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px var(--color-shadow-focus);
}

.form-input:invalid {
    border-color: var(--color-danger);
}

.form-input::placeholder {
    color: var(--color-text-muted);
}

.form-select {
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-2xl);
    font-size: var(--font-size-base);
    font-family: inherit;
    background: var(--color-surface);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.form-select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px var(--color-shadow-focus);
}

.form-textarea {
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-2xl);
    font-size: var(--font-size-base);
    font-family: inherit;
    resize: vertical;
    min-height: 100px;
    transition: all var(--transition-fast);
    background: var(--color-surface);
    color: var(--color-text-primary);
}

.form-textarea:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px var(--color-shadow-focus);
}

/* 表單驗證狀態 */
.form-error {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-1);
}

.form-success {
    color: var(--color-success);
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-1);
}

/* 表單按鈕組 */
.form-actions {
    display: flex;
    gap: var(--spacing-3);
    justify-content: flex-end;
    margin-top: var(--spacing-6);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
}

/* ===== 房間代號輸入樣式 ===== */
.join-room-container {
    margin-top: var(--spacing-6);
    padding: var(--spacing-6);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
    border-radius: var(--radius-3xl);
    border: 2px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    animation: slideDown var(--transition-normal);
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.room-input-group {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
    margin-bottom: var(--spacing-4);
    flex-wrap: wrap;
}

.room-code-input {
    flex: 1;
    min-width: 200px;
    padding: var(--spacing-4) var(--spacing-6);
    border: 3px solid var(--color-border);
    border-radius: var(--radius-2xl);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    text-align: center;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    background: var(--color-surface);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg);
    transition: all var(--transition-normal);
    font-family: 'Courier New', monospace;
}

.room-code-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-shadow-focus), var(--shadow-xl);
    transform: translateY(-2px);
    background: var(--color-surface-hover);
}

.room-code-input::placeholder {
    color: var(--color-text-muted);
    font-weight: var(--font-weight-normal);
    letter-spacing: normal;
    text-transform: none;
}

.room-code-input:invalid {
    border-color: var(--color-danger);
    box-shadow: 0 0 0 4px rgba(229, 62, 62, 0.1);
}

.room-join-btn {
    padding: var(--spacing-4) var(--spacing-8);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    border-radius: var(--radius-2xl);
    min-width: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    box-shadow: var(--shadow-lg);
    transition: all var(--transition-normal);
}

.room-join-btn:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-2xl);
}

.room-join-btn:active {
    transform: translateY(-1px);
}

.room-code-hint {
    text-align: center;
    padding: var(--spacing-3);
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-xl);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.room-code-hint p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 房間代號輸入動畫效果 */
.room-code-input:focus + .room-join-btn {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% {
        box-shadow: var(--shadow-lg);
    }
    50% {
        box-shadow: 0 0 0 8px rgba(66, 153, 225, 0.1), var(--shadow-lg);
    }
}

/* 排行榜樣式 */
.leaderboard-main {
    padding: 2rem;
    max-width: 1000px;
    margin: 0 auto;
}

.leaderboard-container {
    background: rgba(255, 255, 255, 0.95);
    padding: 2rem;
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.search-section {
    margin-bottom: 2rem;
}

#search-input {
    width: 100%;
    max-width: 400px;
    padding: 0.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 25px;
    font-size: 1rem;
}

.leaderboard-table table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}

.leaderboard-table th,
.leaderboard-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
}

.leaderboard-table th {
    background: #f7fafc;
    font-weight: 600;
    color: #4a5568;
}

.leaderboard-table tr:hover {
    background: #f7fafc;
}`;
}


function getAppJS(): string {
  return `// OmniAI 五子棋 JavaScript

class GomokuGame {
    constructor() {
        this.gameState = null;
        this.canvas = null;
        this.ctx = null;
        this.cellSize = 40;
        this.boardSize = 15;
        this.isMyTurn = false;
        this.myPlayer = null;
        this.websocket = null;
        this.aiDifficulty = 'medium'; // 默認中等難度
        
        this.init();
    }
    
    init() {
        // 根據當前頁面初始化
        const path = window.location.pathname;
        
        // 如果是首頁，載入用戶問候語
        if (path === '/') {
            this.loadUserGreeting();
        } else if (path === '/game') {
            this.initGamePage();
        } else if (path === '/room') {
            this.initRoomPage();
        } else if (path === '/profile') {
            this.initProfilePage();
        } else if (path === '/leaderboard') {
            this.initLeaderboardPage();
        }
    }
    
    initGamePage() {
        this.canvas = document.getElementById('game-board');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.canvas.addEventListener('click', (e) => this.handleBoardClick(e));
            this.drawBoard();
            
            // 從 URL 參數獲取遊戲模式和難度
            const params = new URLSearchParams(window.location.search);
            const mode = params.get('mode') || 'ai';
            const difficulty = params.get('difficulty') || 'medium';
            const gameId = params.get('gameId');
            
            // 設置初始難度
            this.aiDifficulty = difficulty;
            
            if (gameId) {
                this.loadGame(gameId);
            } else {
                this.createGame(mode);
            }
            
            // 如果是 AI 模式，顯示難度選擇器並設置當前難度
            if (mode === 'ai') {
                const difficultySelector = document.getElementById('difficulty-selector');
                const difficultySelect = document.getElementById('ai-difficulty');
                
                if (difficultySelector) {
                    difficultySelector.style.display = 'flex';
                }
                
                if (difficultySelect) {
                    difficultySelect.value = difficulty;
                }
            }
        }
    }
    
    initRoomPage() {
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('code');
        
        if (roomCode) {
            this.joinRoom(roomCode);
        } else {
            // 如果沒有房間代碼，創建新房間
            this.createNewRoom();
        }
    }
    
    initProfilePage() {
        this.loadProfile();
    }
    
    initLeaderboardPage() {
        this.loadLeaderboard();
    }
    
    async createNewRoom() {
        try {
            const userId = this.getCurrentUserId();
            
            const response = await fetch('/api/room/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'pvp',
                    userId: userId
                })
            });
            
            const data = await response.json();
            
            if (data.roomCode) {
                // 更新頁面顯示房間代碼
                const roomCodeEl = document.getElementById('room-code');
                const shareCodeEl = document.getElementById('share-code');
                
                if (roomCodeEl) {
                    roomCodeEl.textContent = \`房間代碼: \${data.roomCode}\`;
                }
                
                if (shareCodeEl) {
                    shareCodeEl.textContent = data.roomCode;
                }
                
                // 連接 WebSocket 並自動加入房間
                console.log('準備連接到房間:', data.roomCode);
                this.connectToRoom(data.roomCode);
                
                // 顯示創建成功提示
                this.showRoomCreatedToast(data.roomCode);
                
                console.log('房間創建成功:', data.roomCode);
            } else {
                throw new Error(data.error || '創建房間失敗');
            }
        } catch (error) {
            console.error('創建房間失敗:', error);
            alert('創建房間失敗，請稍後再試');
        }
    }
    
    async joinRoom(roomCode) {
        try {
            const userId = this.getCurrentUserId();
            
            // 調用 API 加入房間
            const response = await fetch('/api/room/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomCode: roomCode,
                    userId: userId
                })
            });
            
            const data = await response.json();
            
            if (data.gameId) {
                // 更新頁面顯示房間代碼
                const roomCodeEl = document.getElementById('room-code');
                const shareCodeEl = document.getElementById('share-code');
                
                if (roomCodeEl) {
                    roomCodeEl.textContent = \`房間代碼: \${roomCode}\`;
                }
                
                if (shareCodeEl) {
                    shareCodeEl.textContent = roomCode;
                }
                
                // 連接 WebSocket
                this.connectToRoom(roomCode);
                
                console.log('成功加入房間:', roomCode);
            } else {
                throw new Error(data.error || '加入房間失敗');
            }
        } catch (error) {
            console.error('加入房間失敗:', error);
            alert(\`加入房間失敗: \${error.message}\`);
            // 返回首頁
            window.location.href = '/';
        }
    }
    
    connectToRoom(roomCode) {
        // WebSocket 連接邏輯
        const userId = this.getCurrentUserId();
        const wsUrl = \`wss://\${window.location.host}/api/room/\${roomCode}/websocket?userId=\${userId}\`;
        
        console.log('WebSocket 連接 URL:', wsUrl);
        console.log('房間代碼:', roomCode, '用戶ID:', userId);
        
        try {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket 連接成功');
                
                // 發送加入房間訊息
                this.websocket.send(JSON.stringify({
                    type: 'join',
                    data: { player: null }, // 讓伺服器自動分配玩家顏色
                    timestamp: Date.now()
                }));
            };
            
            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket 連接關閉');
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket 錯誤:', error);
            };
        } catch (error) {
            console.error('WebSocket 連接失敗:', error);
        }
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'gameState':
                if (message.data) {
                    this.gameState = message.data;
                    this.updateGameDisplay();
                    this.drawBoard();
                    
                    // 更新玩家信息顯示
                    this.updateRoomPlayerInfo();
                    
                    // 檢查遊戲是否結束，顯示彈窗
                    console.log('檢查遊戲狀態:', this.gameState.status, '獲勝者:', this.gameState.winner);
                    if (this.gameState.status === 'finished') {
                        console.log('遊戲結束，準備顯示彈窗');
                        setTimeout(() => {
                            console.log('顯示遊戲結束彈窗');
                            this.showGameOverModal();
                        }, 1000); // 延遲1秒顯示，讓玩家看到最後一步
                    }
                    
                    // 如果遊戲開始，隱藏等待區域，顯示遊戲區域
                    if (this.gameState.status === 'playing') {
                        const waitingArea = document.getElementById('waiting-area');
                        const gameArea = document.getElementById('game-area');
                        
                        if (waitingArea) waitingArea.style.display = 'none';
                        if (gameArea) gameArea.style.display = 'block';
                        
                        // 初始化棋盤
                        this.canvas = document.getElementById('game-board');
                        if (this.canvas) {
                            this.ctx = this.canvas.getContext('2d');
                            this.canvas.addEventListener('click', (e) => this.handleRoomBoardClick(e));
                            this.drawBoard();
                        }
                        
                        // 確定自己的玩家顏色
                        const myUserId = this.getCurrentUserId();
                        if (this.gameState.players.black === myUserId) {
                            this.myPlayer = 'black';
                        } else if (this.gameState.players.white === myUserId) {
                            this.myPlayer = 'white';
                        }
                        
                        this.isMyTurn = this.gameState.currentPlayer === this.myPlayer;
                    }
                }
                break;
                
            case 'join':
                console.log('玩家加入:', message.data.userId);
                this.updatePlayerCount();
                break;
                
            case 'leave':
                console.log('玩家離開:', message.data.userId);
                this.updatePlayerCount();
                break;
                
            case 'chat':
                this.displayChatMessage(message.data);
                break;
                
            case 'error':
                console.error('房間錯誤:', message.data.message);
                break;
        }
    }
    
    updatePlayerCount() {
        // 更新玩家數量顯示
        const playerCountEl = document.getElementById('player-count');
        if (playerCountEl && this.gameState) {
            const playerCount = Object.keys(this.gameState.players).filter(key => this.gameState.players[key]).length;
            playerCountEl.textContent = \`玩家: \${playerCount}/2\`;
        }
    }
    
    updateRoomPlayerInfo() {
        if (!this.gameState) return;
        
        const blackPlayerEl = document.getElementById('black-player');
        const whitePlayerEl = document.getElementById('white-player');
        
        if (blackPlayerEl) {
            if (this.gameState.players.black) {
                const userId = this.gameState.players.black;
                blackPlayerEl.textContent = userId.startsWith('匿名玩家_') ? 
                    userId : \`玩家 \${userId.slice(-6)}\`;
            } else {
                blackPlayerEl.textContent = '等待中...';
            }
        }
        
        if (whitePlayerEl) {
            if (this.gameState.players.white) {
                const userId = this.gameState.players.white;
                whitePlayerEl.textContent = userId.startsWith('匿名玩家_') ? 
                    userId : \`玩家 \${userId.slice(-6)}\`;
            } else {
                whitePlayerEl.textContent = '等待中...';
            }
        }
        
        // 更新玩家數量
        this.updatePlayerCount();
    }
    
    displayChatMessage(chatData) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messageEl = document.createElement('div');
            messageEl.className = 'chat-message';
            messageEl.innerHTML = \`
                <span class="chat-user">\${chatData.userId}:</span>
                <span class="chat-text">\${chatData.message}</span>
            \`;
            chatMessages.appendChild(messageEl);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    showRoomCreatedToast(roomCode) {
        const toast = document.createElement('div');
        toast.innerHTML = \`
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span>🎉</span>
                <div>
                    <div style="font-weight: 600;">房間創建成功！</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">房間代碼: \${roomCode}</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">您已自動加入房間</div>
                </div>
            </div>
        \`;
        toast.style.cssText = \`
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        \`;
        
        document.body.appendChild(toast);
        
        // 5秒後移除提示
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
    
    async createGame(mode) {
        try {
            const response = await fetch('/api/game/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    mode,
                    userId: this.getCurrentUserId()
                })
            });
            
            const data = await response.json();
            if (data.gameState) {
                this.gameState = data.gameState;
                this.myPlayer = 'black'; // 玩家總是黑棋
                this.isMyTurn = this.gameState.currentPlayer === this.myPlayer;
                this.updateGameDisplay();
            }
        } catch (error) {
            console.error('創建遊戲失敗:', error);
        }
    }
    
    async loadGame(gameId) {
        try {
            const response = await fetch(\`/api/game/state/\${gameId}\`);
            const data = await response.json();
            
            if (data.gameState) {
                this.gameState = data.gameState;
                this.updateGameDisplay();
                this.drawBoard();
            }
        } catch (error) {
            console.error('載入遊戲失敗:', error);
        }
    }
    
    async makeMove(row, col) {
        if (!this.gameState || !this.isMyTurn || this.gameState.status !== 'playing') {
            return;
        }
        
        try {
            const response = await fetch('/api/game/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: this.gameState.id,
                    position: { row, col },
                    player: this.myPlayer
                })
            });
            
            const data = await response.json();
            if (data.gameState) {
                this.gameState = data.gameState;
                this.isMyTurn = false;
                this.updateGameDisplay();
                this.drawBoard();
                
                // 如果是 AI 模式且遊戲還在進行，請求 AI 落子
                if (this.gameState.mode === 'ai' && this.gameState.status === 'playing') {
                    setTimeout(() => this.requestAIMove(), 1000);
                }
            }
        } catch (error) {
            console.error('落子失敗:', error);
        }
    }
    
    async requestAIMove() {
        try {
            const response = await fetch('/api/game/ai-move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: this.gameState.id,
                    difficulty: this.aiDifficulty
                })
            });
            
            const data = await response.json();
            if (data.gameState) {
                this.gameState = data.gameState;
                this.isMyTurn = this.gameState.currentPlayer === this.myPlayer;
                this.updateGameDisplay();
                this.drawBoard();
                
                // 顯示 AI 分析
                if (data.aiMove) {
                    this.showAIAnalysis(data.aiMove, data.analysis);
                }
            }
        } catch (error) {
            console.error('AI 落子失敗:', error);
        }
    }
    
    handleBoardClick(event) {
        if (!this.isMyTurn) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        
        if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
            if (!this.gameState.board[row][col]) {
                this.makeMove(row, col);
            }
        }
    }
    
    handleRoomBoardClick(event) {
        if (!this.isMyTurn || !this.myPlayer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        
        if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
            if (!this.gameState.board[row] || !this.gameState.board[row][col]) {
                this.makeRoomMove(row, col);
            }
        }
    }
    
    makeRoomMove(row, col) {
        if (!this.websocket || !this.myPlayer) return;
        
        // 通過 WebSocket 發送落子指令
        this.websocket.send(JSON.stringify({
            type: 'move',
            data: { position: { row, col } },
            timestamp: Date.now()
        }));
        
        // 暫時禁用點擊，等待伺服器響應
        this.isMyTurn = false;
    }
    
    drawBoard() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const size = this.cellSize;
        
        // 清空畫布
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 繪製網格
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < this.boardSize; i++) {
            // 垂直線
            ctx.beginPath();
            ctx.moveTo(i * size + size/2, size/2);
            ctx.lineTo(i * size + size/2, (this.boardSize - 1) * size + size/2);
            ctx.stroke();
            
            // 水平線
            ctx.beginPath();
            ctx.moveTo(size/2, i * size + size/2);
            ctx.lineTo((this.boardSize - 1) * size + size/2, i * size + size/2);
            ctx.stroke();
        }
        
        // 繪製天元等標記點
        const markPoints = [
            [3, 3], [3, 11], [11, 3], [11, 11], [7, 7]
        ];
        
        ctx.fillStyle = '#8B4513';
        markPoints.forEach(([row, col]) => {
            ctx.beginPath();
            ctx.arc(col * size + size/2, row * size + size/2, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // 繪製棋子
        if (this.gameState && this.gameState.board) {
            for (let row = 0; row < this.boardSize; row++) {
                for (let col = 0; col < this.boardSize; col++) {
                    const piece = this.gameState.board[row][col];
                    if (piece) {
                        this.drawPiece(row, col, piece);
                    }
                }
            }
        }
    }
    
    drawPiece(row, col, player) {
        const ctx = this.ctx;
        const x = col * this.cellSize + this.cellSize/2;
        const y = row * this.cellSize + this.cellSize/2;
        const radius = this.cellSize/2 - 2;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        
        if (player === 'black') {
            ctx.fillStyle = '#2D3748';
        } else {
            ctx.fillStyle = '#FFFFFF';
        }
        
        ctx.fill();
        ctx.strokeStyle = '#4A5568';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    updateGameDisplay() {
        if (!this.gameState) return;
        
        // 更新當前玩家顯示
        const currentPlayerEl = document.getElementById('current-player');
        if (currentPlayerEl) {
            currentPlayerEl.textContent = this.gameState.currentPlayer === 'black' ? '黑棋回合' : '白棋回合';
        }
        
        // 更新遊戲狀態
        const gameStatusEl = document.getElementById('game-status');
        if (gameStatusEl) {
            if (this.gameState.status === 'finished') {
                if (this.gameState.winner === 'draw') {
                    gameStatusEl.textContent = '平局';
                } else {
                    gameStatusEl.textContent = \`\${this.gameState.winner === 'black' ? '黑棋' : '白棋'}獲勝\`;
                }
                
                // 顯示遊戲結束彈窗
                this.showGameOverModal();
            } else {
                gameStatusEl.textContent = '遊戲進行中';
            }
        }
        
        // 更新走法記錄
        this.updateMoveHistory();
    }
    
    updateMoveHistory() {
        const movesListEl = document.getElementById('moves-list');
        if (!movesListEl || !this.gameState) return;
        
        movesListEl.innerHTML = '';
        this.gameState.moves.forEach((move, index) => {
            const moveEl = document.createElement('div');
            moveEl.className = 'move-item';
            moveEl.textContent = \`\${index + 1}. \${move.player === 'black' ? '黑' : '白'}(\${move.position.row}, \${move.position.col})\`;
            movesListEl.appendChild(moveEl);
        });
        
        // 滾動到底部
        movesListEl.scrollTop = movesListEl.scrollHeight;
    }
    
    showAIAnalysis(aiMove, analysis) {
        const analysisEl = document.getElementById('ai-analysis');
        const contentEl = document.getElementById('analysis-content');
        
        if (analysisEl && contentEl) {
            analysisEl.style.display = 'block';
            contentEl.innerHTML = \`
                <p><strong>AI 落子：</strong>(\${aiMove.position.row}, \${aiMove.position.col})</p>
                <p><strong>信心度：</strong>\${(aiMove.confidence * 100).toFixed(1)}%</p>
                <p><strong>理由：</strong>\${aiMove.reasoning}</p>
                \${analysis ? \`
                    <hr style="margin: 1rem 0;">
                    <p><strong>局面評估：</strong>\${analysis.advantage === 'advantage' ? '優勢' : analysis.advantage === 'disadvantage' ? '劣勢' : '平局'}</p>
                    <p><strong>分析：</strong>\${analysis.reasoning}</p>
                \` : ''}
            \`;
        }
    }
    
    showGameOverModal() {
        console.log('showGameOverModal 被調用');
        
        if (!this.gameState || this.gameState.status !== 'finished') {
            console.log('遊戲狀態檢查失敗:', this.gameState?.status);
            return;
        }
        
        const modal = document.getElementById('game-over-modal');
        const titleEl = document.getElementById('game-result-title');
        const iconEl = document.getElementById('game-result-icon');
        const messageEl = document.getElementById('game-result-message');
        const durationEl = document.getElementById('game-duration');
        const movesEl = document.getElementById('total-moves');
        
        console.log('DOM 元素檢查:', {
            modal: !!modal,
            titleEl: !!titleEl,
            iconEl: !!iconEl,
            messageEl: !!messageEl,
            durationEl: !!durationEl,
            movesEl: !!movesEl
        });
        
        if (!modal || !titleEl || !iconEl || !messageEl || !durationEl || !movesEl) {
            console.log('缺少必要的 DOM 元素');
            return;
        }
        
        // 計算遊戲時長
        const duration = this.gameState.updatedAt - this.gameState.createdAt;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        // 設置彈窗內容
        if (this.gameState.winner === 'draw') {
            titleEl.textContent = '平局';
            iconEl.textContent = '🤝';
            messageEl.textContent = '勢均力敵，不分勝負！';
            modal.querySelector('.game-over-content').classList.remove('winner-effect');
        } else {
            const isPlayerWin = (this.gameState.winner === 'black' && this.myPlayer === 'black') || 
                               (this.gameState.winner === 'white' && this.myPlayer === 'white');
            
            if (this.gameState.mode === 'ai') {
                if (isPlayerWin) {
                    titleEl.textContent = '恭喜獲勝！';
                    iconEl.textContent = '🎉';
                    messageEl.textContent = '您戰勝了 AI，棋藝精湛！';
                    modal.querySelector('.game-over-content').classList.add('winner-effect');
                } else {
                    titleEl.textContent = '遊戲結束';
                    iconEl.textContent = '🤖';
                    messageEl.textContent = 'AI 獲勝，再接再厲！';
                    modal.querySelector('.game-over-content').classList.remove('winner-effect');
                }
            } else {
                titleEl.textContent = \`\${this.gameState.winner === 'black' ? '黑棋' : '白棋'}獲勝！\`;
                iconEl.textContent = '👑';
                messageEl.textContent = \`\${this.gameState.winner === 'black' ? '黑棋' : '白棋'}玩家獲得勝利！\`;
                modal.querySelector('.game-over-content').classList.add('winner-effect');
            }
        }
        
        // 設置統計信息
        durationEl.textContent = \`遊戲時長: \${minutes}分\${seconds}秒\`;
        movesEl.textContent = \`總步數: \${this.gameState.moves.length}步\`;
        
        // 顯示彈窗
        modal.style.display = 'flex';
        console.log('遊戲結束彈窗已顯示');
        
        // 直接綁定按鈕事件
        const restartBtn = document.getElementById('restart-btn');
        const homeBtn = document.getElementById('home-btn');
        const leaveBtn = document.getElementById('leave-btn');
        const analyzeBtn = document.getElementById('analyze-btn');
        
        console.log('檢查按鈕元素:', {
            restartBtn: !!restartBtn,
            homeBtn: !!homeBtn,
            leaveBtn: !!leaveBtn,
            analyzeBtn: !!analyzeBtn
        });
        
        if (restartBtn) {
            restartBtn.onclick = function() {
                console.log('重新開始按鈕被點擊');
                restartGame();
            };
        }
        
        if (homeBtn) {
            homeBtn.onclick = function() {
                console.log('返回首頁按鈕被點擊');
                returnToHome();
            };
        }
        
        if (leaveBtn) {
            leaveBtn.onclick = function() {
                console.log('離開房間按鈕被點擊');
                leaveRoom();
            };
        }
        
        if (analyzeBtn) {
            analyzeBtn.onclick = function() {
                console.log('分析棋局按鈕被點擊');
                analyzeGame();
            };
        }
        
        console.log('按鈕事件已綁定');
        
        // 添加慶祝音效（如果需要的話）
        if (this.gameState.winner !== 'draw') {
            this.playCelebrationSound();
        }
    }
    
    
    playCelebrationSound() {
        // 簡單的音效提示，使用 Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            // 如果音效播放失敗，靜默處理
            console.log('音效播放不可用');
        }
    }
    
    getCurrentUserId() {
        // 簡單的用戶 ID 生成，實際應用中應該使用真實的用戶認證
        let userId = localStorage.getItem('userId');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', userId);
        }
        return userId;
    }
    
    async loadUserGreeting() {
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                // 如果有 token，嘗試獲取用戶信息
                const response = await fetch('/api/user/me', {
                    headers: getAuthHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const greetingEl = document.getElementById('user-greeting');
                    if (greetingEl && data.user) {
                        greetingEl.textContent = \`您好，\${data.user.username}\`;
                    }
                    // 更新個人資料卡片
                    this.updateProfileCard(data.user);
                } else {
                    // Token 無效，清除本地存儲
                    localStorage.removeItem('userId');
                    localStorage.removeItem('username');
                    localStorage.removeItem('authToken');
                    this.showGuestProfile();
                }
            } else {
                this.showGuestProfile();
            }
        } catch (error) {
            console.error('載入用戶問候語失敗:', error);
            this.showGuestProfile();
        }
    }
    
    showGuestProfile() {
        const greetingEl = document.getElementById('user-greeting');
        if (greetingEl) {
            const userId = this.getCurrentUserId();
            const anonymousId = \`匿名玩家_\${userId.slice(-6)}\`;
            greetingEl.textContent = \`您好，\${anonymousId}\`;
        }
        this.updateProfileCard(null);
    }
    
    updateProfileCard(user) {
        const profileDescription = document.getElementById('profile-description');
        const profileButton = document.getElementById('profile-button');
        const headerLogoutBtn = document.querySelector('.header-logout-btn');
        
        if (user) {
            // 已登入用戶
            profileDescription.innerHTML = \`
                <p>歡迎回來，<strong>\${user.username}</strong>！</p>
                <div class="user-stats">
                    <p>評分：<strong>\${user.rating}</strong></p>
                    <p>勝率：<strong>\${user.wins + user.losses + user.draws > 0 ? 
                        ((user.wins / (user.wins + user.losses + user.draws)) * 100).toFixed(1) + '%' : '0%'}</strong></p>
                </div>
            \`;
            profileButton.innerHTML = \`
                <button class="btn secondary" onclick="window.location.href='/profile'">查看資料</button>
                <button class="btn warning" onclick="showChangePasswordModal()">更改密碼</button>
            \`;
            if (headerLogoutBtn) {
                headerLogoutBtn.style.display = 'inline-block';
            }
        } else {
            // 未登入用戶
            profileDescription.textContent = '管理帳號和戰績';
            profileButton.innerHTML = '<button class="btn secondary" onclick="showLoginModal()">登入/註冊</button>';
            if (headerLogoutBtn) {
                headerLogoutBtn.style.display = 'none';
            }
        }
    }
    
    async loadProfile() {
        const userId = this.getCurrentUserId();
        
        try {
            const response = await fetch(\`/api/user/profile/\${userId}\`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.user) {
                this.displayProfile(data.user);
            }
            
            // 載入統計數據
            const statsResponse = await fetch(\`/api/user/stats/\${userId}\`, {
                headers: getAuthHeaders()
            });
            const statsData = await statsResponse.json();
            
            if (statsData.stats) {
                this.displayStats(statsData.stats);
            }
            
            // 載入遊戲歷史
            const historyResponse = await fetch(\`/api/user/history/\${userId}\`, {
                headers: getAuthHeaders()
            });
            const historyData = await historyResponse.json();
            
            if (historyData.history) {
                this.displayHistory(historyData.history);
            }
        } catch (error) {
            console.error('載入個人資料失敗:', error);
        }
    }
    
    displayProfile(user) {
        const elements = {
            username: user.username,
            rating: user.rating,
            wins: user.wins,
            losses: user.losses,
            draws: user.draws,
            'win-rate': user.wins + user.losses + user.draws > 0 ? 
                ((user.wins / (user.wins + user.losses + user.draws)) * 100).toFixed(1) + '%' : '0%'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }
    
    displayStats(stats) {
        // 顯示評分變化圖表
        this.drawRatingChart(stats.ratingHistory);
    }
    
    displayHistory(history) {
        const historyEl = document.getElementById('game-history');
        if (!historyEl) return;
        
        if (history.length === 0) {
            historyEl.innerHTML = '<p>還沒有對局記錄</p>';
            return;
        }
        
        historyEl.innerHTML = history.map(game => \`
            <div class="history-item">
                <div class="game-result \${game.result}">
                    \${game.result === 'win' ? '勝利' : game.result === 'loss' ? '失敗' : '平局'}
                </div>
                <div class="game-details">
                    <p>模式: \${game.mode === 'ai' ? 'AI 對戰' : '玩家對戰'}</p>
                    <p>時長: \${Math.floor(game.duration / 60000)}分\${Math.floor((game.duration % 60000) / 1000)}秒</p>
                    <p>評分變化: \${game.ratingChange > 0 ? '+' : ''}\${game.ratingChange}</p>
                </div>
                <div class="game-date">
                    \${new Date(game.createdAt).toLocaleDateString('zh-TW')}
                </div>
            </div>
        \`).join('');
    }
    
    drawRatingChart(ratingHistory) {
        const canvas = document.getElementById('rating-chart');
        if (!canvas || !ratingHistory || ratingHistory.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // 清空畫布
        ctx.clearRect(0, 0, width, height);
        
        if (ratingHistory.length < 2) return;
        
        // 計算數據範圍
        const ratings = ratingHistory.map(h => h.rating);
        const minRating = Math.min(...ratings) - 50;
        const maxRating = Math.max(...ratings) + 50;
        const ratingRange = maxRating - minRating;
        
        // 繪製網格
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        
        // 水平網格線
        for (let i = 0; i <= 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 繪製評分線
        ctx.strokeStyle = '#4299E1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        ratingHistory.forEach((point, index) => {
            const x = (width / (ratingHistory.length - 1)) * index;
            const y = height - ((point.rating - minRating) / ratingRange) * height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // 繪製數據點
        ctx.fillStyle = '#4299E1';
        ratingHistory.forEach((point, index) => {
            const x = (width / (ratingHistory.length - 1)) * index;
            const y = height - ((point.rating - minRating) / ratingRange) * height;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
    
    async loadLeaderboard() {
        try {
            const response = await fetch('/api/user/leaderboard?limit=50');
            const data = await response.json();
            
            if (data.leaderboard) {
                this.displayLeaderboard(data.leaderboard);
            }
        } catch (error) {
            console.error('載入排行榜失敗:', error);
        }
    }
    
    displayLeaderboard(leaderboard) {
        const tbody = document.getElementById('leaderboard-body');
        if (!tbody) return;
        
        if (leaderboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">暫無排行數據</td></tr>';
            return;
        }
        
        tbody.innerHTML = leaderboard.map((user, index) => \`
            <tr>
                <td>\${index + 1}</td>
                <td>\${user.username}</td>
                <td>\${user.rating}</td>
                <td>\${user.wins}</td>
                <td>\${user.losses}</td>
                <td>\${user.wins + user.losses + user.draws > 0 ? 
                    ((user.wins / (user.wins + user.losses + user.draws)) * 100).toFixed(1) + '%' : '0%'}</td>
            </tr>
        \`).join('');
    }
}

// 全域函數
let game = new GomokuGame();

// 獲取認證標頭
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = \`Bearer \${token}\`;
    }
    return headers;
}

// 直接載入用戶問候語的函數
async function loadUserGreetingDirectly() {
    try {
        const token = localStorage.getItem('authToken');
        if (token) {
            // 如果有 token，嘗試獲取用戶信息
            const response = await fetch('/api/user/me', {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const greetingEl = document.getElementById('user-greeting');
                if (greetingEl && data.user) {
                    greetingEl.textContent = \`您好，\${data.user.username}\`;
                }
                // 更新個人資料卡片
                updateProfileCardDirectly(data.user);
            } else {
                // Token 無效，清除本地存儲
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('authToken');
                showGuestProfileDirectly();
            }
        } else {
            showGuestProfileDirectly();
        }
    } catch (error) {
        console.error('載入用戶問候語失敗:', error);
        showGuestProfileDirectly();
    }
}

// 直接更新個人資料卡片的函數
function updateProfileCardDirectly(user) {
    const profileDescription = document.getElementById('profile-description');
    const profileButton = document.getElementById('profile-button');
    const headerLogoutBtn = document.querySelector('.header-logout-btn');
    
    if (user) {
        // 已登入用戶
        profileDescription.innerHTML = \`
            <p>歡迎回來，<strong>\${user.username}</strong>！</p>
            <div class="user-stats">
                <p>評分：<strong>\${user.rating}</strong></p>
                <p>勝率：<strong>\${user.wins + user.losses + user.draws > 0 ? 
                    ((user.wins / (user.wins + user.losses + user.draws)) * 100).toFixed(1) + '%' : '0%'}</strong></p>
            </div>
        \`;
        profileButton.innerHTML = \`
            <button class="btn secondary" onclick="window.location.href='/profile'">查看資料</button>
            <button class="btn warning" onclick="showChangePasswordModal()">更改密碼</button>
        \`;
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = 'inline-block';
        }
    } else {
        // 未登入用戶
        profileDescription.textContent = '管理帳號和戰績';
        profileButton.innerHTML = '<button class="btn secondary" onclick="showLoginModal()">登入/註冊</button>';
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = 'none';
        }
    }
}

// 直接顯示訪客資料的函數
function showGuestProfileDirectly() {
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl) {
        let userId = localStorage.getItem('userId');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', userId);
        }
        const anonymousId = \`匿名玩家_\${userId.slice(-6)}\`;
        greetingEl.textContent = \`您好，\${anonymousId}\`;
    }
    updateProfileCardDirectly(null);
}

function changeDifficulty() {
    const select = document.getElementById('ai-difficulty');
    if (select && game) {
        game.aiDifficulty = select.value;
        
        // 顯示難度變更提示
        const difficultyNames = {
            'easy': '簡單',
            'medium': '中等', 
            'hard': '困難'
        };
        
        // 創建提示元素
        const toast = document.createElement('div');
        toast.textContent = \`AI 難度已設為：\${difficultyNames[select.value]}\`;
        toast.style.cssText = \`
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4299e1;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        \`;
        
        // 添加動畫樣式
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        \`;
        document.head.appendChild(style);
        
        document.body.appendChild(toast);
        
        // 3秒後移除提示
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, 3000);
    }
}

function startAIGame() {
    const difficultySelect = document.getElementById('home-ai-difficulty');
    const difficulty = difficultySelect ? difficultySelect.value : 'medium';
    window.location.href = \`/game?mode=ai&difficulty=\${difficulty}\`;
}

function showRoomOptions() {
    document.getElementById('room-options').style.display = 'flex';
}

function hideRoomOptions() {
    document.getElementById('room-options').style.display = 'none';
}

function createRoom() {
    window.location.href = '/room';
}

function showJoinRoom() {
    document.getElementById('join-room').style.display = 'block';
}

function joinRoom() {
    const roomCode = document.getElementById('roomCode').value.toUpperCase();
    if (roomCode.length === 4) {
        window.location.href = \`/room?code=\${roomCode}\`;
    }
}

function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
}

function hideLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

function toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const emailField = document.getElementById('email');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch');
    const submitBtn = document.querySelector('#auth-form button');
    
    if (title.textContent === '登入') {
        title.textContent = '註冊';
        emailField.style.display = 'block';
        switchText.textContent = '已有帳號？';
        switchLink.textContent = '登入';
        submitBtn.textContent = '註冊';
    } else {
        title.textContent = '登入';
        emailField.style.display = 'none';
        switchText.textContent = '還沒有帳號？';
        switchLink.textContent = '註冊';
        submitBtn.textContent = '登入';
    }
}

function restartGame() {
    // 隱藏彈窗
    const modal = document.getElementById('game-over-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // 檢查當前頁面類型
    const path = window.location.pathname;
    
    if (path === '/room') {
        // 房間模式：重新載入房間頁面
        console.log('房間模式重新開始');
        location.reload();
    } else {
        // 遊戲模式：創建新遊戲
        const url = new URL(window.location);
        const mode = url.searchParams.get('mode') || 'ai';
        
        if (game) {
            game.createGame(mode);
        } else {
            location.reload();
        }
    }
}

function returnToHome() {
    console.log('返回首頁按鈕被點擊');
    
    // 隱藏彈窗
    const modal = document.getElementById('game-over-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // 如果在房間中，先發送離開訊息
    if (game && game.websocket && window.location.pathname === '/room') {
        try {
            game.websocket.send(JSON.stringify({
                type: 'leave',
                data: {},
                timestamp: Date.now()
            }));
            game.websocket.close();
        } catch (error) {
            console.log('發送離開訊息失敗:', error);
        }
    }
    
    window.location.href = '/';
}

function analyzeGame() {
    if (!game || !game.gameState) return;
    
    // 隱藏彈窗
    const modal = document.getElementById('game-over-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // 顯示分析面板
    const analysisEl = document.getElementById('ai-analysis');
    const suggestionsEl = document.getElementById('suggestions');
    
    if (analysisEl) {
        analysisEl.style.display = 'block';
        const contentEl = document.getElementById('analysis-content');
        if (contentEl) {
            contentEl.innerHTML = \`
                <h4>🎯 對局總結</h4>
                <p><strong>遊戲結果：</strong>\${game.gameState.winner === 'draw' ? '平局' : 
                    (game.gameState.winner === 'black' ? '黑棋獲勝' : '白棋獲勝')}</p>
                <p><strong>總步數：</strong>\${game.gameState.moves.length} 步</p>
                <p><strong>遊戲時長：</strong>\${Math.floor((game.gameState.updatedAt - game.gameState.createdAt) / 60000)}分鐘</p>
                <hr style="margin: 1rem 0;">
                <p>🔍 <strong>棋局分析：</strong></p>
                <p>• 這是一局精彩的對戰</p>
                <p>• 雙方都展現了不錯的棋藝</p>
                <p>• 關鍵轉折點在中盤階段</p>
            \`;
        }
    }
    
    if (suggestionsEl) {
        suggestionsEl.style.display = 'block';
    }
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !game.websocket) return;
    
    const message = chatInput.value.trim();
    if (message.length === 0) return;
    
    // 發送聊天訊息
    game.websocket.send(JSON.stringify({
        type: 'chat',
        data: { message },
        timestamp: Date.now()
    }));
    
    // 清空輸入框
    chatInput.value = '';
}

function leaveRoom() {
    console.log('嘗試離開房間');
    
    // 隱藏彈窗（如果有的話）
    const modal = document.getElementById('game-over-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (confirm('確定要離開房間嗎？')) {
        if (game && game.websocket) {
            try {
                game.websocket.send(JSON.stringify({
                    type: 'leave',
                    data: {},
                    timestamp: Date.now()
                }));
                game.websocket.close();
            } catch (error) {
                console.log('發送離開訊息失敗:', error);
            }
        }
        console.log('離開房間，返回首頁');
        window.location.href = '/';
    }
}

async function analyzePosition() {
    if (!game.gameState) return;
    
    try {
        const response = await fetch('/api/game/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: game.gameState.id,
                player: game.myPlayer
            })
        });
        
        const data = await response.json();
        if (data.analysis) {
            game.showAIAnalysis({ position: { row: 0, col: 0 }, reasoning: '', confidence: 0 }, data.analysis);
        }
        
        if (data.suggestions) {
            const suggestionsEl = document.getElementById('suggestions');
            const contentEl = document.getElementById('suggestions-content');
            
            if (suggestionsEl && contentEl) {
                suggestionsEl.style.display = 'block';
                contentEl.innerHTML = \`
                    <p><strong>建議走法：</strong></p>
                    \${data.suggestions.suggestions.map((pos, i) => 
                        \`<p>\${i + 1}. (\${pos.row}, \${pos.col})</p>\`
                    ).join('')}
                    <p><strong>理由：</strong></p>
                    \${data.suggestions.reasoning.map(reason => 
                        \`<p>• \${reason}</p>\`
                    ).join('')}
                \`;
            }
        }
    } catch (error) {
        console.error('分析位置失敗:', error);
    }
}

async function searchPlayers() {
    const query = document.getElementById('search-input').value;
    if (query.length < 2) {
        game.loadLeaderboard();
        return;
    }
    
    try {
        const response = await fetch(\`/api/user/search?q=\${encodeURIComponent(query)}\`);
        const data = await response.json();
        
        if (data.users) {
            game.displayLeaderboard(data.users);
        }
    } catch (error) {
        console.error('搜索用戶失敗:', error);
    }
}

// 表單提交處理
document.addEventListener('DOMContentLoaded', function() {
    // 聊天輸入框 Enter 鍵支援
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // 移除事件委託，改用直接綁定
    
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const isLogin = document.getElementById('auth-title').textContent === '登入';
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch(\`/api/user/\${isLogin ? 'login' : 'register'}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(isLogin ? 
                        { username, password } : 
                        { username, email, password }
                    )
                });
                
                const data = await response.json();
                if (data.user && data.token) {
                    localStorage.setItem('userId', data.user.id);
                    localStorage.setItem('username', data.user.username);
                    localStorage.setItem('authToken', data.token);
                    hideLoginModal();
                    alert(\`\${isLogin ? '登入' : '註冊'}成功！\`);
                    
                    // 重新載入用戶問候語和更新個人資料卡片
                    setTimeout(() => {
                        if (typeof game !== 'undefined' && game.loadUserGreeting) {
                            game.loadUserGreeting();
                        } else {
                            // 如果 game 對象還不可用，直接調用相關函數
                            loadUserGreetingDirectly();
                        }
                    }, 100);
                } else {
                    alert(data.error || \`\${isLogin ? '登入' : '註冊'}失敗\`);
                }
            } catch (error) {
                console.error(\`\${isLogin ? '登入' : '註冊'}失敗:\`, error);
                alert(\`\${isLogin ? '登入' : '註冊'}失敗\`);
            }
        });
    }
    
    // 更改密碼表單處理
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // 驗證新密碼
            if (newPassword !== confirmPassword) {
                alert('新密碼和確認密碼不一致');
                return;
            }
            
            if (newPassword.length < 6) {
                alert('新密碼至少需要 6 個字符');
                return;
            }
            
            // 檢查密碼強度
            const hasLetter = /[a-zA-Z]/.test(newPassword);
            const hasNumber = /\d/.test(newPassword);
            
            if (!hasLetter) {
                alert('新密碼必須包含至少一個字母');
                return;
            }
            
            if (!hasNumber) {
                alert('新密碼必須包含至少一個數字');
                return;
            }
            
            try {
                const response = await fetch('/api/user/change-password', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });
                
                const data = await response.json();
                if (response.ok) {
                    alert('密碼更改成功！');
                    hideChangePasswordModal();
                } else {
                    alert(data.error || '密碼更改失敗');
                }
            } catch (error) {
                console.error('更改密碼失敗:', error);
                alert('更改密碼失敗');
            }
        });
    }
    
    // 登出功能
    window.logout = function() {
        if (confirm('確定要登出嗎？')) {
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('authToken');
            window.location.href = '/';
        }
    };
    
    // 顯示更改密碼彈窗
    window.showChangePasswordModal = function() {
        const modal = document.getElementById('change-password-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };
    
    // 隱藏更改密碼彈窗
    window.hideChangePasswordModal = function() {
        const modal = document.getElementById('change-password-modal');
        if (modal) {
            modal.style.display = 'none';
            // 清空表單
            document.getElementById('change-password-form').reset();
        }
    };
});`;
}

function getUtilsJS(): string {
  return `// 工具函數

// CORS 標頭
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
};

// 生成隨機 ID
export function generateId(): string {
    return crypto.randomUUID();
}

// 格式化時間
export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('zh-TW');
}

// 計算遊戲時長
export function calculateDuration(startTime: number, endTime: number): number {
    return endTime - startTime;
}

// 驗證房間代碼
export function isValidRoomCode(code: string): boolean {
    return /^[A-Z0-9]{4}$/.test(code);
}

// 驗證用戶名
export function isValidUsername(username: string): boolean {
    return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username);
}

// 驗證電子郵件
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}`;
}
