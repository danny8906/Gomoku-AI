/**
 * 靜態資源處理器
 */

import { Env } from '../types';
import { detectLanguage, getTranslations, Translations } from '../utils/i18n';

export async function serveStaticAssets(
  request: Request,
  _env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const language = detectLanguage(request);
  const t = getTranslations(language);

  // 根據路徑返回對應的靜態資源
  switch (path) {
    case '/':
      return new Response(getIndexHTML(t, language), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    case '/game':
      return new Response(getGameHTML(t, language), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    case '/room':
      return new Response(getRoomHTML(t, language), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    case '/profile':
      return new Response(getProfileHTML(t, language), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    case '/leaderboard':
      return new Response(getLeaderboardHTML(t, language), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    case '/app.js':
      return new Response(getAppJS(t, language), {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
      });

    case '/styles.css':
      return new Response(getStylesCSS(), {
        headers: { 'Content-Type': 'text/css; charset=utf-8' },
      });

    case '/favicon.ico':
      return new Response('', { status: 204 });

    default:
      return new Response('Not found', { status: 404 });
  }
}

function getIndexHTML(t: Translations, language: string): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>OmniAI ${t.gameTitle} - Cloudflare Workers AI</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1><img src="/logo.png" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> OmniAI ${t.gameTitle}</h1>
            <div class="header-right">
                <p id="user-greeting">${language === 'zh-TW' ? '載入中...' : 'Loading...'}</p>
                <button class="btn danger header-logout-btn" onclick="logout()" style="display: none;">${language === 'zh-TW' ? '登出' : 'Logout'}</button>
            </div>
        </header>
        
        <main class="main">
            <div class="welcome-section">
                <h2>${language === 'zh-TW' ? '歡迎來到五子棋世界' : 'Welcome to Gomoku World'}</h2>
                <p>${language === 'zh-TW' ? '體驗由 Cloudflare Workers AI 驅動的智能對戰' : 'Experience intelligent gameplay powered by Cloudflare Workers AI'}</p>
                
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3>🤖 ${t.aiGame}</h3>
                        <p>${language === 'zh-TW' ? '與智能 AI 對戰，提升棋藝' : 'Battle against intelligent AI and improve your skills'}</p>
                        <div class="ai-difficulty-home">
                            <label for="home-ai-difficulty">${language === 'zh-TW' ? '選擇難度：' : 'Select Difficulty:'}</label>
                            <select id="home-ai-difficulty">
                                <option value="easy">${t.easy}</option>
                                <option value="medium" selected>${t.medium}</option>
                                <option value="hard">${t.hard}</option>
                            </select>
                        </div>
                        <button class="btn primary" onclick="startAIGame()">${language === 'zh-TW' ? '開始 AI 對戰' : 'Start AI Game'}</button>
                    </div>
                    
                    <div class="feature-card">
                        <h3>👥 ${t.pvpGame}</h3>
                        <p>${language === 'zh-TW' ? '與朋友即時對戰' : 'Real-time battle with friends'}</p>
                        <button class="btn primary" onclick="showRoomOptions()">${t.pvpGame}</button>
                    </div>
                    
                    <div class="feature-card">
                        <h3>📊 ${language === 'zh-TW' ? '排行榜' : 'Leaderboard'}</h3>
                        <p>${language === 'zh-TW' ? '查看全球排名' : 'View global rankings'}</p>
                        <button class="btn secondary" onclick="window.location.href='/leaderboard'">${language === 'zh-TW' ? '查看排行榜' : 'View Leaderboard'}</button>
                    </div>
                    
                    <div class="feature-card" id="profile-card">
                        <h3>👤 ${language === 'zh-TW' ? '個人資料' : 'Profile'}</h3>
                        <div id="profile-content">
                            <p id="profile-description">${language === 'zh-TW' ? '管理帳號和戰績' : 'Manage account and stats'}</p>
                            <button class="btn secondary" id="profile-button" onclick="showLoginModal()">${language === 'zh-TW' ? '登入/註冊' : 'Login/Register'}</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="room-options" class="modal" style="display: none;">
                <div class="modal-content">
                    <span class="close" onclick="hideRoomOptions()">&times;</span>
                    <h3>${language === 'zh-TW' ? '玩家對戰選項' : 'PvP Game Options'}</h3>
                    <div class="room-buttons">
                        <button class="btn primary" onclick="createRoom()">${t.createRoom}</button>
                        <button class="btn secondary" onclick="showJoinRoom()">${t.joinRoom}</button>
                    </div>
                    <div id="join-room" class="join-room-container" style="display: none;">
                        <div class="room-input-group">
                            <input type="text" id="roomCode" class="room-code-input" placeholder="${t.enterRoomCode}" maxlength="4">
                            <button class="btn primary room-join-btn" onclick="joinRoom()">
                                <span>🚪</span> ${t.joinRoom}
                            </button>
                        </div>
                        <div class="room-code-hint">
                            <p>💡 ${language === 'zh-TW' ? '房間代碼為4位英文字母' : 'Room code is 4 letters'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="login-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <span class="close" onclick="hideLoginModal()">&times;</span>
                    <h3 id="auth-title">${language === 'zh-TW' ? '登入' : 'Login'}</h3>
                    <form id="auth-form">
                        <div class="form-group">
                            <input type="text" id="username" class="form-input" placeholder="${language === 'zh-TW' ? '用戶名' : 'Username'}" required>
                        </div>
                        <div class="form-group" id="email-group" style="display: none;">
                            <input type="email" id="email" class="form-input" placeholder="${language === 'zh-TW' ? '電子郵件 (註冊時需要)' : 'Email (required for registration)'}" style="display: none;">
                        </div>
                        <div class="form-group">
                            <input type="password" id="password" class="form-input" placeholder="${language === 'zh-TW' ? '密碼' : 'Password'}" required>
                        </div>
                        <button type="submit" class="btn primary">${language === 'zh-TW' ? '登入' : 'Login'}</button>
                    </form>
                    <p style="margin-top: var(--spacing-4); text-align: center;">
                        <span id="auth-switch-text">${language === 'zh-TW' ? '還沒有帳號？' : 'No account yet?'}</span>
                        <a href="#" id="auth-switch" onclick="toggleAuthMode()">${language === 'zh-TW' ? '註冊' : 'Register'}</a>
                    </p>
                </div>
            </div>
            
            <div id="change-password-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <span class="close" onclick="hideChangePasswordModal()">&times;</span>
                    <h3>${language === 'zh-TW' ? '更改密碼' : 'Change Password'}</h3>
                    <form id="change-password-form">
                        <div class="form-group">
                            <input type="password" id="current-password" class="form-input" placeholder="${language === 'zh-TW' ? '當前密碼' : 'Current Password'}" required>
                        </div>
                        <div class="form-group">
                            <input type="password" id="new-password" class="form-input" placeholder="${language === 'zh-TW' ? '新密碼' : 'New Password'}" required>
                        </div>
                        <div class="form-group">
                            <input type="password" id="confirm-password" class="form-input" placeholder="${language === 'zh-TW' ? '確認新密碼' : 'Confirm New Password'}" required>
                        </div>
                        <button type="submit" class="btn primary">${language === 'zh-TW' ? '更改密碼' : 'Change Password'}</button>
                    </form>
                </div>
            </div>
        </main>
        
        <footer class="footer">
            <p>&copy; 2024 OmniAI ${language === 'zh-TW' ? '五子棋' : 'Gomoku'} - ${language === 'zh-TW' ? '由 Cloudflare Workers AI 驅動' : 'Powered by Cloudflare Workers AI'}</p>
        </footer>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getGameHTML(t: Translations, language: string): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${language === 'zh-TW' ? '遊戲中' : 'Playing'} - OmniAI ${t.gameTitle}</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body></body>
    <div id="app">
        <header class="header">
            <h1><img src="/logo.png" width="32" height="32" style="vertical-align: middle; margin-right: 8px;"> OmniAI ${t.gameTitle}</h1>
            <div class="game-info">
                <span id="game-mode">${t.aiGame}</span>
                <span id="current-player">${language === 'zh-TW' ? '黑棋回合' : 'Black Turn'}</span>
                <span id="game-status">${language === 'zh-TW' ? '遊戲進行中' : 'Game in Progress'}</span>
            </div>
        </header>
        
        <main class="game-main">
            <div class="game-container">
                <div class="game-board-container">
                    <canvas id="game-board" width="600" height="600"></canvas>
                    <div id="game-controls">
                        <button class="btn secondary" onclick="window.location.href='/'">${language === 'zh-TW' ? '返回首頁' : 'Back to Home'}</button>
                        <button class="btn primary" onclick="restartGame()">${t.restart}</button>
                        
                        <!-- AI 難度選擇器 -->
                        <div class="difficulty-selector" id="difficulty-selector" style="display: none;">
                            <label for="ai-difficulty">${language === 'zh-TW' ? 'AI 難度：' : 'AI Difficulty:'}</label>
                            <select id="ai-difficulty" onchange="changeDifficulty()">
                                <option value="easy">${t.easy} ${language === 'zh-TW' ? '(30% 次優解)' : '(30% suboptimal)'}</option>
                                <option value="medium" selected>${t.medium} ${language === 'zh-TW' ? '(10% 次優解)' : '(10% suboptimal)'}</option>
                                <option value="hard">${t.hard} ${language === 'zh-TW' ? '(總是最優解)' : '(always optimal)'}</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="game-sidebar">
                    <div class="player-info">
                        <div class="player black">
                            <div class="player-piece"></div>
                            <span>${language === 'zh-TW' ? '黑棋' : 'Black'}</span>
                            <span id="black-player-name">${language === 'zh-TW' ? '玩家' : 'Player'}</span>
                        </div>
                        <div class="player white">
                            <div class="player-piece"></div>
                            <span>${language === 'zh-TW' ? '白棋' : 'White'}</span>
                            <span id="white-player-name">AI</span>
                        </div>
                    </div>
                    
                    <div class="move-history">
                        <h4>${language === 'zh-TW' ? '走法記錄' : 'Move History'}</h4>
                        <div id="moves-list"></div>
                    </div>
                    
                    <div class="ai-status" id="ai-status">
                        <h4>🤖 ${language === 'zh-TW' ? 'AI 狀態' : 'AI Status'}</h4>
                        <div id="ai-status-content">
                            <div class="status-item">
                                <span class="status-label">${language === 'zh-TW' ? '狀態：' : 'Status:'}</span>
                                <span id="ai-current-status">${language === 'zh-TW' ? '等待中' : 'Waiting'}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">${language === 'zh-TW' ? '上一步用時：' : 'Last Move Time:'}</span>
                                <span id="ai-thinking-time">-</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ai-analysis" id="ai-analysis" style="display: none;">
                        <h4>${language === 'zh-TW' ? 'AI 分析' : 'AI Analysis'}</h4>
                        <div id="analysis-content"></div>
                    </div>
                </div>
            </div>
        </main>
        
        <!-- 遊戲結束彈窗 -->
        <div id="game-over-modal" class="modal" style="display: none;">
            <div class="modal-content game-over-content">
                <div class="game-result">
                    <h2 id="game-result-title">${language === 'zh-TW' ? '遊戲結束' : 'Game Over'}</h2>
                    <div id="game-result-icon">🎉</div>
                    <p id="game-result-message">${language === 'zh-TW' ? '恭喜獲勝！' : 'Congratulations!'}</p>
                    <div id="game-stats">
                        <p id="game-duration">${language === 'zh-TW' ? '遊戲時長' : 'Game Duration'}: --</p>
                        <p id="total-moves">${language === 'zh-TW' ? '總步數' : 'Total Moves'}: --</p>
                    </div>
                </div>
                <div class="game-over-buttons">
                    <button class="btn primary" id="restart-btn">
                        <span>🔄</span> ${t.restart}
                    </button>
                    <button class="btn secondary" id="home-btn">
                        <span>🏠</span> ${language === 'zh-TW' ? '返回首頁' : 'Back to Home'}
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getRoomHTML(t: Translations, language: string): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${language === 'zh-TW' ? '房間' : 'Room'} - OmniAI ${t.gameTitle}</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1>♟️ ${language === 'zh-TW' ? 'OmniAI 五子棋房間' : 'OmniAI Gomoku Room'}</h1>
            <div class="room-info">
                <span id="room-code">${language === 'zh-TW' ? '房間代碼' : 'Room Code'}: ----</span>
                <span id="player-count">${language === 'zh-TW' ? '玩家' : 'Players'}: 0/2</span>
                <span id="current-player" style="display: none;">${language === 'zh-TW' ? '黑棋回合' : 'Black Turn'}</span>
                <span id="game-status" style="display: none;">${language === 'zh-TW' ? '遊戲進行中' : 'Game in Progress'}</span>
            </div>
        </header>
        
        <main class="game-main">
            <div class="room-container">
                <div class="waiting-area" id="waiting-area">
                    <h2>${language === 'zh-TW' ? '等待玩家加入...' : 'Waiting for players to join...'}</h2>
                    <div class="share-section">
                        <p>${language === 'zh-TW' ? '分享房間代碼給朋友：' : 'Share room code with friends:'}<strong id="share-code">----</strong></p>
                        <div class="url-section">
                            <label for="room-url">${language === 'zh-TW' ? '房間網址：' : 'Room URL:'}</label>
                            <div class="url-input-group">
                                <input type="text" id="room-url" readonly value="----" class="url-input">
                                <button class="btn copy-btn" onclick="copyRoomUrl()" id="copy-url-btn">
                                    <span id="copy-icon">📋</span> ${language === 'zh-TW' ? '複製網址' : 'Copy URL'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="loading">⏳</div>
                    <div class="waiting-controls">
                        <button class="btn secondary" onclick="goHome()">
                            <span>🏠</span> ${language === 'zh-TW' ? '返回首頁' : 'Back to Home'}
                        </button>
                    </div>
                </div>
                
                <div class="game-area" id="game-area" style="display: none;">
                    <div class="game-container">
                        <div class="game-board-container">
                            <canvas id="game-board" width="600" height="600"></canvas>
                            <div id="game-controls">
                                <button class="btn secondary" onclick="leaveRoom()">${language === 'zh-TW' ? '離開房間' : 'Leave Room'}</button>
                                <button class="btn warning" onclick="requestDraw()" id="draw-btn">${language === 'zh-TW' ? '和棋' : 'Draw'}</button>
                                <button class="btn primary" onclick="restartGame()" style="display: none;">${t.restart}</button>
                            </div>
                        </div>
                        
                        <div class="game-sidebar">
                            <div class="player-info">
                                <div class="player black">
                                    <div class="player-piece"></div>
                                    <span>${language === 'zh-TW' ? '黑棋' : 'Black'}</span>
                                    <span id="black-player">${language === 'zh-TW' ? '等待中...' : 'Waiting...'}</span>
                                    <div class="connection-status" id="black-connection-status" style="display: none;">
                                        <span class="status-dot offline"></span>
                                        <span class="status-text">${language === 'zh-TW' ? '離線' : 'Offline'}</span>
                                    </div>
                                </div>
                                <div class="player white">
                                    <div class="player-piece"></div>
                                    <span>${language === 'zh-TW' ? '白棋' : 'White'}</span>
                                    <span id="white-player">${language === 'zh-TW' ? '等待中...' : 'Waiting...'}</span>
                                    <div class="connection-status" id="white-connection-status" style="display: none;">
                                        <span class="status-dot offline"></span>
                                        <span class="status-text">${language === 'zh-TW' ? '離線' : 'Offline'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="chat-area">
                                <h4>💬 ${language === 'zh-TW' ? '聊天室' : 'Chat Room'}</h4>
                                <div id="chat-messages" class="chat-messages-container"></div>
                                <div class="chat-input">
                                    <input type="text" id="chat-input" placeholder="${language === 'zh-TW' ? '輸入訊息...' : 'Type a message...'}" maxlength="200">
                                    <button onclick="sendMessage()">${language === 'zh-TW' ? '發送' : 'Send'}</button>
                                </div>
                            </div>
                            
                            <div class="move-history">
                                <h4>📝 ${language === 'zh-TW' ? '走法記錄' : 'Move History'}</h4>
                                <div id="moves-list"></div>
                            </div>
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
                        <span>🔄</span> ${language === 'zh-TW' ? '重新開始' : 'Restart'}
                    </button>
                    <button class="btn secondary" id="home-btn">
                        <span>🏠</span> ${language === 'zh-TW' ? '返回首頁' : 'Back to Home'}
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getProfileHTML(t: Translations, language: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${language === 'zh-TW' ? '個人資料' : 'Profile'} - OmniAI ${t.gameTitle}</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1>👤 ${language === 'zh-TW' ? '個人資料' : 'Profile'}</h1>
            <div class="profile-actions">
                <button class="btn secondary" onclick="window.location.href='/'">${language === 'zh-TW' ? '返回首頁' : 'Back to Home'}</button>
                <button class="btn danger" onclick="logout()">${language === 'zh-TW' ? '登出' : 'Logout'}</button>
            </div>
        </header>
        
        <main class="profile-main">
            <div class="profile-container">
                <div class="profile-card">
                    <div class="profile-header">
                        <h2 id="username">${language === 'zh-TW' ? '載入中...' : 'Loading...'}</h2>
                        <div class="rating">
                            <span>${language === 'zh-TW' ? '評分：' : 'Rating:'}</span>
                            <strong id="rating">1200</strong>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h3 id="wins">0</h3>
                            <p>${language === 'zh-TW' ? '勝利' : 'Wins'}</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="losses">0</h3>
                            <p>${language === 'zh-TW' ? '失敗' : 'Losses'}</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="draws">0</h3>
                            <p>${language === 'zh-TW' ? '平局' : 'Draws'}</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="win-rate">0%</h3>
                            <p>${language === 'zh-TW' ? '勝率' : 'Win Rate'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="history-section">
                    <h3>${language === 'zh-TW' ? '最近對局' : 'Recent Games'}</h3>
                    <div id="game-history" class="history-list">
                        ${language === 'zh-TW' ? '載入中...' : 'Loading...'}
                    </div>
                </div>
                
                <div class="rating-chart">
                    <h3>${language === 'zh-TW' ? '評分變化' : 'Rating History'}</h3>
                    <canvas id="rating-chart" width="600" height="200"></canvas>
                </div>
            </div>
        </main>
    </div>
    
    <script src="/app.js"></script>
</body>
</html>`;
}

function getLeaderboardHTML(t: Translations, language: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${language === 'zh-TW' ? '排行榜' : 'Leaderboard'} - OmniAI ${t.gameTitle}</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <h1>🏆 ${language === 'zh-TW' ? '排行榜' : 'Leaderboard'}</h1>
            <button class="btn secondary" onclick="window.location.href='/'">${language === 'zh-TW' ? '返回首頁' : 'Back to Home'}</button>
        </header>
        
        <main class="leaderboard-main">
            <div class="leaderboard-container">
                <div class="search-section">
                    <input type="text" id="search-input" placeholder="${language === 'zh-TW' ? '搜索玩家...' : 'Search players...'}" onkeyup="searchPlayers()">
                </div>
                
                <div class="leaderboard-table">
                    <table>
                        <thead>
                            <tr>
                                <th>${language === 'zh-TW' ? '排名' : 'Rank'}</th>
                                <th>${language === 'zh-TW' ? '玩家' : 'Player'}</th>
                                <th>${language === 'zh-TW' ? '評分' : 'Rating'}</th>
                                <th>${language === 'zh-TW' ? '勝利' : 'Wins'}</th>
                                <th>${language === 'zh-TW' ? '失敗' : 'Losses'}</th>
                                <th>${language === 'zh-TW' ? '勝率' : 'Win Rate'}</th>
                            </tr>
                        </thead>
                        <tbody id="leaderboard-body">
                            <tr>
                                <td colspan="6">${language === 'zh-TW' ? '載入中...' : 'Loading...'}</td>
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
    --color-success-light: #c6f6d5;
    --color-warning: #d69e2e;
    --color-danger: #e53e3e;
    --color-danger-light: #fed7d7;
    --color-info: #3182ce;
    
    --color-background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%);
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
    position: relative;
    z-index: 100;
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
    z-index: -1;
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
    z-index: -1;
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

/* 個人資料頁面樣式 */
.profile-main {
    padding: var(--spacing-6);
    max-width: 1200px;
    margin: 0 auto;
    min-height: calc(100vh - 80px);
}

.profile-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
}

/* 個人資料卡片 */
.profile-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: var(--radius-xl);
    padding: var(--spacing-8);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
}

.profile-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
    pointer-events: none;
}

.profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-6);
    position: relative;
    z-index: 1;
}

.profile-header h2 {
    color: white;
    font-size: 2.5rem;
    font-weight: var(--font-weight-bold);
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.rating {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    background: rgba(255, 255, 255, 0.2);
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-lg);
    backdrop-filter: blur(5px);
}

.rating span {
    color: rgba(255, 255, 255, 0.9);
    font-size: var(--font-size-sm);
}

.rating strong {
    color: white;
    font-size: 1.5rem;
    font-weight: var(--font-weight-bold);
}

/* 統計網格 */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-4);
    position: relative;
    z-index: 1;
}

.stat-card {
    background: rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    text-align: center;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
    pointer-events: none;
}

.stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    background: rgba(255, 255, 255, 0.2);
}

.stat-card h3 {
    color: white;
    font-size: 2rem;
    font-weight: var(--font-weight-bold);
    margin: 0 0 var(--spacing-2) 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    position: relative;
    z-index: 1;
}

.stat-card p {
    color: rgba(255, 255, 255, 0.9);
    font-size: var(--font-size-sm);
    margin: 0;
    font-weight: var(--font-weight-medium);
    position: relative;
    z-index: 1;
}

/* 歷史記錄區域 */
.history-section {
    background: white;
    border-radius: var(--radius-xl);
    padding: var(--spacing-6);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
}

.history-section h3 {
    color: #2d3748;
    font-size: 1.5rem;
    font-weight: var(--font-weight-bold);
    margin: 0 0 var(--spacing-4) 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
}

.history-section h3::before {
    content: '📊';
    font-size: 1.2rem;
}

.history-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
}

.history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    background: #f7fafc;
    border-radius: var(--radius-lg);
    border-left: 4px solid #4299e1;
    transition: all 0.3s ease;
}

.history-item:hover {
    background: #edf2f7;
    transform: translateX(5px);
}

.history-item.win {
    border-left-color: #48bb78;
    background: #f0fff4;
}

.history-item.loss {
    border-left-color: #f56565;
    background: #fff5f5;
}

.history-item.draw {
    border-left-color: #ed8936;
    background: #fffaf0;
}

.history-game-info {
    flex: 1;
}

.history-game-info h4 {
    color: #2d3748;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    margin: 0 0 var(--spacing-1) 0;
}

.history-game-info p {
    color: #718096;
    font-size: var(--font-size-sm);
    margin: 0;
}

.history-result {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
}

.history-result .result-badge {
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    text-transform: uppercase;
}

.history-result .result-badge.win {
    background: #c6f6d5;
    color: #22543d;
}

.history-result .result-badge.loss {
    background: #fed7d7;
    color: #742a2a;
}

.history-result .result-badge.draw {
    background: #feebc8;
    color: #7b341e;
}

.history-result .rating-change {
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-sm);
}

.history-result .rating-change.positive {
    color: #38a169;
}

.history-result .rating-change.negative {
    color: #e53e3e;
}

.history-result .rating-change.neutral {
    color: #718096;
}

/* 評分圖表區域 */
.rating-chart {
    background: white;
    border-radius: var(--radius-xl);
    padding: var(--spacing-6);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
}

.rating-chart h3 {
    color: #2d3748;
    font-size: 1.5rem;
    font-weight: var(--font-weight-bold);
    margin: 0 0 var(--spacing-4) 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
}

.rating-chart h3::before {
    content: '📈';
    font-size: 1.2rem;
}

.rating-chart canvas {
    width: 100%;
    height: 200px;
    border-radius: var(--radius-lg);
    background: #f7fafc;
}

/* 個人資料操作按鈕 */
.profile-actions {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
}

/* 響應式設計 */
@media (max-width: 768px) {
    .profile-main {
        padding: var(--spacing-4);
    }
    
    .profile-header {
        flex-direction: column;
        gap: var(--spacing-4);
        text-align: center;
    }
    
    .profile-header h2 {
        font-size: 2rem;
    }
    
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .history-item {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--spacing-2);
    }
    
    .history-result {
        align-self: flex-end;
    }
    
    .rating-chart canvas {
        height: 150px;
    }
}

@media (max-width: 480px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .profile-actions {
        flex-direction: column;
        width: 100%;
    }
    
    .profile-actions .btn {
        width: 100%;
    }
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
    margin-top: var(--spacing-2);
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

/* 警告按鈕 */
.btn.warning {
    background: var(--color-warning);
    color: var(--color-text-white);
    box-shadow: var(--shadow-md);
}

.btn.warning:hover:not(:disabled) {
    background: #b7791f;
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

/* 和棋確認模態框樣式 */
.draw-confirm-content {
    max-width: 400px;
    text-align: center;
    animation: slideInDown 0.3s ease-out;
}

.draw-confirm-header h3 {
    margin: 0 0 var(--spacing-4) 0;
    color: var(--color-primary);
    font-size: var(--font-size-lg);
}

.draw-confirm-body {
    margin-bottom: var(--spacing-6);
}

.draw-confirm-body p {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text);
    line-height: 1.5;
}

.draw-confirm-buttons {
    display: flex;
    gap: var(--spacing-3);
    justify-content: center;
}

.draw-confirm-buttons .btn {
    min-width: 100px;
    padding: var(--spacing-3) var(--spacing-4);
    font-size: var(--font-size-md);
}

/* 動畫效果 */
@keyframes slideInDown {
    from {
        opacity: 0;
        transform: translateY(-30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
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
    z-index: 99999;
    backdrop-filter: blur(4px);
    animation: modalFadeIn var(--transition-normal);
    overflow: hidden;
    isolation: isolate;
}

/* 防止背景滾動 */
body.modal-open {
    overflow: hidden;
    position: relative;
    height: 100vh;
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
    padding: var(--spacing-6);
    border-radius: var(--radius-4xl);
    box-shadow: var(--shadow-2xl);
    max-width: 480px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    z-index: 100000;
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
    touch-action: none; /* 防止觸控時的默認行為 */
    user-select: none; /* 防止文本選擇 */
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

.move-history, .ai-analysis, .suggestions, .chat-area {
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

.move-history h4, .ai-analysis h4, .suggestions h4, .chat-area h4, .ai-status h4 {
    margin-bottom: 1rem;
    color: #4a5568;
}

#moves-list {
    max-height: 200px;
    overflow-y: auto;
}

/* AI 狀態窗格樣式 */
.ai-status {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    margin: 1rem 0;
    color: #4a5568;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
}

.ai-status h4 {
    color: #4a5568 !important;
    margin-bottom: 0.75rem;
    font-size: 1rem;
}

#ai-status-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
}

.status-label {
    font-weight: 500;
    color: #718096;
}

#ai-current-status {
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    min-width: 60px;
    text-align: center;
    font-size: 0.9rem;
    color: #4a5568;
}

#ai-thinking-time {
    font-weight: 600;
    color: #2d3748;
    font-family: 'Courier New', monospace;
    background: #f7fafc;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
}

/* AI 狀態動畫 */
.ai-thinking {
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

/* 聊天室樣式 */
.chat-messages-container {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem;
    background: #f8fafc;
}

.chat-message {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 6px;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chat-message.system-message {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    font-style: italic;
}

.chat-user {
    font-weight: 600;
    color: #4299e1;
    margin-right: 0.5rem;
}

.chat-text.system-text {
    color: #92400e;
    font-weight: 500;
}

.chat-text {
    color: #2d3748;
}

.chat-input {
    display: flex;
    gap: 0.5rem;
}

.chat-input input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
}

.chat-input button {
    padding: 0.5rem 1rem;
    background: #4299e1;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s;
}

.chat-input button:hover {
    background: #3182ce;
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
        touch-action: none; /* 防止觸控時的默認行為 */
        user-select: none; /* 防止文本選擇 */
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

.waiting-controls {
    margin-top: var(--spacing-6);
    display: flex;
    justify-content: center;
    gap: var(--spacing-4);
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

/* 斷線倒計時樣式 */
.disconnect-countdown {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 193, 7, 0.95);
    color: #856404;
    padding: 2rem;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    text-align: center;
    border: 3px solid #ffc107;
    animation: pulse 1s infinite;
}

.countdown-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.countdown-timer {
    font-size: 3rem;
    font-weight: bold;
    color: #dc3545;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    animation: bounce 1s infinite;
}

.countdown-text {
    font-size: 1.2rem;
    font-weight: 600;
}

@keyframes pulse {
    0% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.05); }
    100% { transform: translate(-50%, -50%) scale(1); }
}

@keyframes bounce {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-10px); }
    60% { transform: translateY(-5px); }
}

/* 連接狀態指示器樣式 */
.connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.9rem;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse-dot 2s infinite;
}

.status-dot.online {
    background-color: #28a745;
}

.status-dot.offline {
    background-color: #dc3545;
}

.status-dot.reconnecting {
    background-color: #ffc107;
}

.status-text {
    font-weight: 500;
}

@keyframes pulse-dot {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
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

/* 優化的表單輸入樣式 */
.form-input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-2xl);
    font-size: var(--font-size-base);
    font-family: inherit;
    font-weight: var(--font-weight-medium);
    transition: all var(--transition-normal);
    background: var(--color-surface);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-sm);
    position: relative;
    margin-bottom: 0;
    box-sizing: border-box;
    min-height: 44px;
}

.form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 4px rgba(66, 153, 225, 0.1), var(--shadow-lg);
    transform: translateY(-1px);
    background: var(--color-surface-hover);
}

.form-input:hover:not(:focus) {
    border-color: var(--color-border-hover);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

.form-input:invalid {
    border-color: var(--color-danger);
    box-shadow: 0 0 0 4px rgba(229, 62, 62, 0.1);
}

.form-input:valid:not(:placeholder-shown) {
    border-color: var(--color-success);
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
}

.form-input::placeholder {
    color: var(--color-text-muted);
    font-weight: var(--font-weight-normal);
    transition: all var(--transition-fast);
}

.form-input:focus::placeholder {
    color: var(--color-text-muted);
    transform: translateY(-2px);
    font-size: var(--font-size-sm);
}

/* 登入/註冊表單特殊樣式 */
#auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-6);
}

#auth-form input {
    position: relative;
    padding-left: var(--spacing-12);
    background-image: none;
    background-repeat: no-repeat;
    background-position: var(--spacing-4) center;
    background-size: 20px 20px;
}

#username {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: var(--spacing-4) center;
    background-size: 20px 20px;
    padding-left: var(--spacing-12);
    padding-right: var(--spacing-4);
}

#email {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: var(--spacing-4) center;
    background-size: 20px 20px;
    padding-left: var(--spacing-12);
    padding-right: var(--spacing-4);
}

#password {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: var(--spacing-4) center;
    background-size: 20px 20px;
    padding-left: var(--spacing-12);
    padding-right: var(--spacing-4);
}


/* 表單驗證狀態 */
.form-group {
    position: relative;
    margin-bottom: var(--spacing-4);
    min-height: 60px;
}

.form-group.error input {
    border-color: var(--color-danger);
    box-shadow: 0 0 0 4px rgba(229, 62, 62, 0.1);
}

.form-group.success input {
    border-color: var(--color-success);
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
}

.form-error {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-danger-light);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-danger);
    animation: slideDown var(--transition-normal);
    z-index: 1000;
    box-shadow: var(--shadow-md);
}

.form-success {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    color: var(--color-success);
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-1);
    padding: var(--spacing-2);
    background: var(--color-success-light);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-success);
    animation: slideDown var(--transition-normal);
    z-index: 1000;
    box-shadow: var(--shadow-md);
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

/* 輸入框動畫效果 */
.form-input:focus {
    animation: inputFocus var(--transition-normal);
}

@keyframes inputFocus {
    0% {
        transform: translateY(0) scale(1);
    }
    50% {
        transform: translateY(-2px) scale(1.02);
    }
    100% {
        transform: translateY(-1px) scale(1);
    }
}

/* 響應式設計 */
@media (max-width: 768px) {
    .form-input {
        padding: var(--spacing-3) var(--spacing-4);
        font-size: var(--font-size-sm);
    }
    
    #auth-form input {
        padding-left: var(--spacing-10);
        background-size: 18px 18px;
        background-position: var(--spacing-3) center;
    }
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
}

/* 房間等待區域樣式 */
.waiting-area {
    text-align: center;
    padding: 2rem;
}

.waiting-area h2 {
    color: #4a5568;
    margin-bottom: 1rem;
}

.share-section {
    margin-bottom: 2rem;
}

.share-section p {
    color: #718096;
    margin-bottom: 1.5rem;
    font-size: 1.1rem;
}

.share-section strong {
    color: #2d3748;
    font-size: 1.2rem;
    background: #f7fafc;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 2px solid #e2e8f0;
    display: inline-block;
    margin: 0 0.5rem;
}

.url-section {
    margin-top: 1.5rem;
}

.url-section label {
    display: block;
    color: #4a5568;
    font-weight: 500;
    margin-bottom: 0.5rem;
    font-size: 1rem;
}

.url-input-group {
    display: flex;
    gap: 0.5rem;
    max-width: 500px;
    margin: 0 auto;
    align-items: center;
}

.url-input {
    flex: 1;
    padding: 0.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    background: #f7fafc;
    color: #4a5568;
    font-family: 'Courier New', monospace;
}

.url-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.copy-btn {
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.copy-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.copy-btn:active {
    transform: translateY(0);
}

.copy-btn.copied {
    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
}

.copy-btn.copied #copy-icon::before {
    content: '✓';
}

.waiting-controls {
    margin-top: 2rem;
}

.loading {
    font-size: 2rem;
    margin: 1rem 0;
    animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* 響應式房間樣式 */
@media (max-width: 768px) {
    .url-input-group {
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .copy-btn {
        width: 100%;
        justify-content: center;
    }
}
}`;
}

function getAppJS(t: Translations, language: string): string {
  return `// OmniAI 五子棋 JavaScript

// 多語言支持
const currentLanguage = '${language}';
const translations = ${JSON.stringify(t)};

function t(key) {
    return translations[key] || key;
}

function updateUIText() {
    // 更新個人資料卡片
    const profileDescription = document.getElementById('profile-description');
    const profileButton = document.getElementById('profile-button');
    
    if (profileDescription && profileButton) {
        if (currentLanguage === 'zh-TW') {
            profileDescription.textContent = '管理帳號和戰績';
            profileButton.textContent = '登入/註冊';
        } else {
            profileDescription.textContent = 'Manage account and stats';
            profileButton.textContent = 'Login/Register';
        }
    }
    
    // 更新登入模態框
    const authTitle = document.getElementById('auth-title');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authSwitch = document.getElementById('auth-switch');
    const submitBtn = document.querySelector('#auth-form button');
    
    if (authTitle && authSwitchText && authSwitch && submitBtn) {
        if (currentLanguage === 'zh-TW') {
            authTitle.textContent = '登入';
            authSwitchText.textContent = '還沒有帳號？';
            authSwitch.textContent = '註冊';
            submitBtn.textContent = '登入';
        } else {
            authTitle.textContent = 'Login';
            authSwitchText.textContent = 'No account yet?';
            authSwitch.textContent = 'Register';
            submitBtn.textContent = 'Login';
        }
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.textContent = message;
    
    // 根據類型設置不同的樣式
    let backgroundColor, borderColor, shadowColor;
    switch (type) {
        case 'error':
            backgroundColor = '#fee2e2';
            borderColor = '#dc2626';
            shadowColor = 'rgba(220, 38, 38, 0.3)';
            break;
        case 'warning':
            backgroundColor = '#fef3c7';
            borderColor = '#f59e0b';
            shadowColor = 'rgba(245, 158, 11, 0.3)';
            break;
        case 'success':
            backgroundColor = '#d1fae5';
            borderColor = '#10b981';
            shadowColor = 'rgba(16, 185, 129, 0.3)';
            break;
        default:
            backgroundColor = '#dbeafe';
            borderColor = '#3b82f6';
            shadowColor = 'rgba(59, 130, 246, 0.3)';
    }
    
    toast.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        background: \${backgroundColor};
        color: \${type === 'error' ? '#dc2626' : (type === 'warning' ? '#92400e' : (type === 'success' ? '#065f46' : '#1e40af'))};
        padding: 1rem 1.5rem;
        border-radius: 12px;
        border-left: 4px solid \${borderColor};
        box-shadow: 0 8px 25px \${shadowColor};
        z-index: 1000;
        font-weight: 600;
        font-size: 1rem;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
        transform: translateX(0);
    \`;
    
    document.body.appendChild(toast);
    
    // 延長顯示時間，特別是error類型
    const displayTime = type === 'error' ? 5000 : 3000;
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, displayTime);
}

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
        this.lastMove = null; // 追蹤最後一步
        this.touchPreview = null; // 觸控預覽位置
        
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
            // 添加點擊和觸控事件支持
            this.canvas.addEventListener('click', (e) => this.handleBoardClick(e));
            this.canvas.addEventListener('touchstart', (e) => this.handleBoardTouch(e), { passive: false });
            this.canvas.addEventListener('touchmove', (e) => this.handleBoardTouch(e), { passive: false });
            this.canvas.addEventListener('touchend', (e) => this.handleBoardTouch(e), { passive: false });
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
                const roomUrlEl = document.getElementById('room-url');
                
                if (roomCodeEl) {
                    roomCodeEl.textContent = \`\${currentLanguage === 'zh-TW' ? '房間代碼' : 'Room Code'}: \${data.roomCode}\`;
                }
                
                if (shareCodeEl) {
                    shareCodeEl.textContent = data.roomCode;
                }
                
                // 設置房間URL
                if (roomUrlEl) {
                    const roomUrl = \`\${window.location.origin}/room?code=\${data.roomCode}\`;
                    roomUrlEl.value = roomUrl;
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
                const roomUrlEl = document.getElementById('room-url');
                
                if (roomCodeEl) {
                    roomCodeEl.textContent = \`\${currentLanguage === 'zh-TW' ? '房間代碼' : 'Room Code'}: \${roomCode}\`;
                }
                
                if (shareCodeEl) {
                    shareCodeEl.textContent = roomCode;
                }
                
                // 設置房間URL
                if (roomUrlEl) {
                    const roomUrl = \`\${window.location.origin}/room?code=\${roomCode}\`;
                    roomUrlEl.value = roomUrl;
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
                
                // 初始化連接狀態為線上
                const currentUserId = this.getCurrentUserId();
                this.updatePlayerConnectionStatus(currentUserId, 'online');
                
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
            
            this.websocket.onclose = (event) => {
                console.log('WebSocket 連接關閉 - 代碼: ' + event.code + ', 原因: ' + event.reason);
                
                // 更新連接狀態為離線
                const currentUserId = this.getCurrentUserId();
                this.updatePlayerConnectionStatus(currentUserId, 'offline');
                
                // 如果是正常關閉（用戶主動離開），不需要顯示錯誤訊息
                if (event.code === 1000) {
                    console.log('WebSocket 正常關閉（用戶主動離開房間）');
                } else {
                    console.log('WebSocket 異常關閉');
                    // 可以考慮顯示重連提示
                    showToast(
                        currentLanguage === 'zh-TW' ? '連接已斷開' : 'Connection lost', 
                        'warning'
                    );
                }
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
                    // 追蹤最後一步
                    if (this.gameState.moves && this.gameState.moves.length > 0) {
                        const lastMove = this.gameState.moves[this.gameState.moves.length - 1];
                        this.lastMove = { row: lastMove.position.row, col: lastMove.position.col };
                    }
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
                            // 添加點擊和觸控事件支持
                            this.canvas.addEventListener('click', (e) => this.handleRoomBoardClick(e));
                            this.canvas.addEventListener('touchstart', (e) => this.handleRoomBoardTouch(e), { passive: false });
                            this.canvas.addEventListener('touchmove', (e) => this.handleRoomBoardTouch(e), { passive: false });
                            this.canvas.addEventListener('touchend', (e) => this.handleRoomBoardTouch(e), { passive: false });
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
                console.log('Player joined:', message.data.userId);
                this.updatePlayerCount();
                break;
                
            case 'leave':
                console.log('Player left:', message.data.userId);
                this.updatePlayerCount();
                break;
                
            case 'chat':
                this.displayChatMessage(message.data);
                break;
                
            case 'playerDisconnected':
                this.handlePlayerDisconnected(message.data);
                break;
                
            case 'playerReconnected':
                this.handlePlayerReconnected(message.data);
                break;
                
            case 'gameEnd':
                this.handleGameEnd(message.data);
                break;
                
            case 'drawRequest':
                this.handleDrawRequest(message.data);
                break;
                
            case 'drawRejected':
                this.handleDrawRejected(message.data);
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
            playerCountEl.textContent = \`\${currentLanguage === 'zh-TW' ? '玩家' : 'Players'}: \${playerCount}/2\`;
        }
    }
    
    updateRoomPlayerInfo() {
        if (!this.gameState) return;
        
        const blackPlayerEl = document.getElementById('black-player');
        const whitePlayerEl = document.getElementById('white-player');
        
        if (blackPlayerEl) {
            if (this.gameState.players.black) {
                const userId = this.gameState.players.black;
                blackPlayerEl.textContent = userId.startsWith('Anonymous_') ? 
                    userId : \`\${currentLanguage === 'zh-TW' ? '玩家' : 'Player'} \${userId.slice(-6)}\`;
            } else {
                blackPlayerEl.textContent = currentLanguage === 'zh-TW' ? '等待中...' : 'Waiting...';
            }
        }
        
        if (whitePlayerEl) {
            if (this.gameState.players.white) {
                const userId = this.gameState.players.white;
                whitePlayerEl.textContent = userId.startsWith('Anonymous_') ? 
                    userId : \`\${currentLanguage === 'zh-TW' ? '玩家' : 'Player'} \${userId.slice(-6)}\`;
            } else {
                whitePlayerEl.textContent = currentLanguage === 'zh-TW' ? '等待中...' : 'Waiting...';
            }
        }
        
        // 更新回合顯示
        this.updateRoomTurnDisplay();
        
        // 更新玩家數量
        this.updatePlayerCount();
    }
    
    updateRoomTurnDisplay() {
        if (!this.gameState) return;
        
        const currentPlayerEl = document.getElementById('current-player');
        const gameStatusEl = document.getElementById('game-status');
        
        // 只在遊戲進行中顯示回合信息
        if (this.gameState.status === 'playing') {
            if (currentPlayerEl) {
                currentPlayerEl.style.display = 'inline';
                const playerName = this.gameState.currentPlayer === 'black' ? 
                    (currentLanguage === 'zh-TW' ? '黑棋' : 'Black') : 
                    (currentLanguage === 'zh-TW' ? '白棋' : 'White');
                currentPlayerEl.textContent = \`\${playerName}\${currentLanguage === 'zh-TW' ? '回合' : ' Turn'}\`;
            }
            
            if (gameStatusEl) {
                gameStatusEl.style.display = 'inline';
                gameStatusEl.textContent = currentLanguage === 'zh-TW' ? '遊戲進行中' : 'Game in Progress';
            }
        } else if (this.gameState.status === 'finished') {
            if (currentPlayerEl) {
                currentPlayerEl.style.display = 'none';
            }
            
            if (gameStatusEl) {
                gameStatusEl.style.display = 'inline';
                if (this.gameState.winner === 'draw') {
                    gameStatusEl.textContent = currentLanguage === 'zh-TW' ? '平局' : 'Draw';
                } else {
                    const winnerName = this.gameState.winner === 'black' ? 
                        (currentLanguage === 'zh-TW' ? '黑棋' : 'Black') : 
                        (currentLanguage === 'zh-TW' ? '白棋' : 'White');
                    gameStatusEl.textContent = \`\${winnerName}\${currentLanguage === 'zh-TW' ? '獲勝' : ' Wins'}\`;
                }
            }
        } else {
            // 等待狀態
            if (currentPlayerEl) {
                currentPlayerEl.style.display = 'none';
            }
            
            if (gameStatusEl) {
                gameStatusEl.style.display = 'none';
            }
        }
    }
    
    displayChatMessage(chatData) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messageEl = document.createElement('div');
            
            // 系統消息使用特殊樣式
            if (chatData.isSystem || chatData.userId === 'system') {
                messageEl.className = 'chat-message system-message';
                messageEl.innerHTML = \`
                    <span class="chat-text system-text">\${chatData.message}</span>
                \`;
            } else {
                messageEl.className = 'chat-message';
                // 統一格式化用戶ID顯示
                const displayUserId = chatData.userId.startsWith('Anonymous_') ? 
                    chatData.userId : 
                    \`\${currentLanguage === 'zh-TW' ? '玩家' : 'Player'} \${chatData.userId.slice(-6)}\`;
                
                messageEl.innerHTML = \`
                    <span class="chat-user">\${displayUserId}:</span>
                    <span class="chat-text">\${chatData.message}</span>
                \`;
            }
            
            chatMessages.appendChild(messageEl);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    handlePlayerDisconnected(data) {
        const currentUserId = this.getCurrentUserId();
        
        // 更新連接狀態顯示
        this.updatePlayerConnectionStatus(data.userId, 'offline');
        
        if (data.userId === currentUserId) {
            // 如果是自己斷線，顯示重連提示
            showToast(currentLanguage === 'zh-TW' ? 
                '⚠️ 您已斷線，請重新連接' : 
                '⚠️ You have disconnected, please reconnect', 'error');
        } else {
            // 如果是對手斷線，顯示倒計時
            const displayUserId = data.userId.startsWith('Anonymous_') ? 
                data.userId : 
                \`\${currentLanguage === 'zh-TW' ? '玩家' : 'Player'} \${data.userId.slice(-6)}\`;
            
            // 顯示更明顯的提示
            showToast(
                currentLanguage === 'zh-TW' ? 
                    \`🔴 \${displayUserId} 已離開，30秒後您將獲勝\` : 
                    \`🔴 \${displayUserId} has left, you will win in 30 seconds\`, 
                'error'
            );
            
            // 在聊天室中記錄玩家離開事件
            this.displayChatMessage({
                userId: 'system',
                message: currentLanguage === 'zh-TW' ? 
                    \`⚠️ \${displayUserId} 已離開房間，30秒後遊戲將結束\` : 
                    \`⚠️ \${displayUserId} has left the room, game will end in 30 seconds\`,
                isSystem: true
            });
            
            // 顯示倒計時
            this.startDisconnectCountdown(data.timeout);
        }
    }
    
    handlePlayerReconnected(data) {
        const currentUserId = this.getCurrentUserId();
        
        // 更新連接狀態顯示
        this.updatePlayerConnectionStatus(data.userId, 'online');
        
        if (data.userId !== currentUserId) {
            const displayUserId = data.userId.startsWith('Anonymous_') ? 
                data.userId : 
                \`\${currentLanguage === 'zh-TW' ? '玩家' : 'Player'} \${data.userId.slice(-6)}\`;
            
            // 顯示更明顯的重連提示
            showToast(
                currentLanguage === 'zh-TW' ? 
                    \`✅ \${displayUserId} 已重新連接\` : 
                    \`✅ \${displayUserId} has reconnected\`, 
                'success'
            );
            
            // 在聊天室中記錄玩家重連事件
            this.displayChatMessage({
                userId: 'system',
                message: currentLanguage === 'zh-TW' ? 
                    \`✅ \${displayUserId} 已重新連接房間\` : 
                    \`✅ \${displayUserId} has reconnected to the room\`,
                isSystem: true
            });
            
            // 停止倒計時
            this.stopDisconnectCountdown();
        }
    }
    
    handleGameEnd(data) {
        console.log('收到遊戲結束消息:', data);
        
        if (data.reason === 'opponentTimeout') {
            this.gameState = data.gameState;
            this.updateGameDisplay();
            this.drawBoard();
            
            // 顯示獲勝彈窗
            setTimeout(() => {
                this.showGameOverModal();
            }, 1000);
            
            showToast(
                currentLanguage === 'zh-TW' ? 
                    '對手超時，您獲勝了！' : 
                    'Opponent timed out, you win!', 
                'success'
            );
        } else if (data.result === 'draw') {
            // 處理和棋情況
            console.log('遊戲以和棋結束');
            
            // 更新遊戲狀態
            if (this.gameState) {
                this.gameState.status = 'finished';
                this.gameState.result = 'draw';
                this.gameState.winner = 'draw';
            }
            
            // 隱藏和棋確認模態框（如果還開著）
            this.hideDrawConfirmModal();
            
            // 顯示遊戲結束彈窗
            setTimeout(() => {
                this.showGameOverModal();
            }, 1000);
            
            showToast(
                currentLanguage === 'zh-TW' ? 
                    '遊戲以和棋結束！' : 
                    'Game ended in a draw!', 
                'success'
            );
        }
    }
    
    handleDrawRequest(data) {
        console.log('收到和棋請求:', data);
        
        // 檢查是否是自己的請求（不應該向自己發送確認）
        const currentUserId = this.getCurrentUserId();
        if (data.from === currentUserId) {
            console.log('這是自己的和棋請求，不顯示確認對話框');
            return;
        }
        
        // 顯示自定義和棋確認模態框
        this.showDrawConfirmModal(data.from);
    }
    
    handleDrawRejected(data) {
        console.log('和棋請求被拒絕:', data);
        
        showToast(
            currentLanguage === 'zh-TW' ? '對方拒絕了和棋請求' : 'Draw request was rejected',
            'info'
        );
    }
    
    showDrawConfirmModal(fromUserId) {
        // 創建和棋確認模態框
        const modal = document.createElement('div');
        modal.id = 'draw-confirm-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const playerName = fromUserId.startsWith('Anonymous_') 
            ? fromUserId 
            : (currentLanguage === 'zh-TW' ? '玩家' : 'Player') + ' ' + fromUserId.slice(-6);
        
        modal.innerHTML = 
            '<div class="modal-content draw-confirm-content">' +
                '<div class="draw-confirm-header">' +
                    '<h3>' + (currentLanguage === 'zh-TW' ? '🤝 和棋請求' : '🤝 Draw Request') + '</h3>' +
                '</div>' +
                '<div class="draw-confirm-body">' +
                    '<p>' + (currentLanguage === 'zh-TW' ? playerName + ' 提議和棋，是否接受？' : playerName + ' requests a draw, do you accept?') + '</p>' +
                '</div>' +
                '<div class="draw-confirm-buttons">' +
                    '<button class="btn primary" onclick="game.acceptDraw()">' +
                        (currentLanguage === 'zh-TW' ? '✅ 接受' : '✅ Accept') +
                    '</button>' +
                    '<button class="btn secondary" onclick="game.rejectDraw()">' +
                        (currentLanguage === 'zh-TW' ? '❌ 拒絕' : '❌ Reject') +
                    '</button>' +
                '</div>' +
            '</div>';
        
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
    }
    
    acceptDraw() {
        this.hideDrawConfirmModal();
        respondToDraw(true);
    }
    
    rejectDraw() {
        this.hideDrawConfirmModal();
        respondToDraw(false);
    }
    
    hideDrawConfirmModal() {
        const modal = document.getElementById('draw-confirm-modal');
        if (modal) {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
    }
    
    startDisconnectCountdown(timeout) {
        // 創建倒計時顯示
        const countdownEl = document.createElement('div');
        countdownEl.id = 'disconnect-countdown';
        countdownEl.className = 'disconnect-countdown';
        countdownEl.innerHTML = \`
            <div class="countdown-content">
                <div class="countdown-timer" id="countdown-timer">30</div>
                <div class="countdown-text">\${currentLanguage === 'zh-TW' ? '秒後獲勝' : 'seconds until victory'}</div>
            </div>
        \`;
        
        document.body.appendChild(countdownEl);
        
        // 開始倒計時
        let timeLeft = 30;
        const timer = setInterval(() => {
            timeLeft--;
            const timerEl = document.getElementById('countdown-timer');
            if (timerEl) {
                timerEl.textContent = timeLeft.toString();
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                this.stopDisconnectCountdown();
            }
        }, 1000);
        
        // 保存計時器引用
        this.disconnectCountdownTimer = timer;
    }
    
    stopDisconnectCountdown() {
        if (this.disconnectCountdownTimer) {
            clearInterval(this.disconnectCountdownTimer);
            this.disconnectCountdownTimer = null;
        }
        
        const countdownEl = document.getElementById('disconnect-countdown');
        if (countdownEl) {
            countdownEl.remove();
        }
    }
    
    updatePlayerConnectionStatus(userId, status) {
        if (!this.gameState) return;
        
        // 確定是黑棋還是白棋玩家
        let playerType = null;
        if (this.gameState.players.black === userId) {
            playerType = 'black';
        } else if (this.gameState.players.white === userId) {
            playerType = 'white';
        }
        
        if (playerType) {
            const statusEl = document.getElementById(\`\${playerType}-connection-status\`);
            if (statusEl) {
                const dotEl = statusEl.querySelector('.status-dot');
                const textEl = statusEl.querySelector('.status-text');
                
                if (dotEl && textEl) {
                    // 移除所有狀態類別
                    dotEl.classList.remove('online', 'offline', 'reconnecting');
                    statusEl.style.display = 'flex';
                    
                    switch (status) {
                        case 'online':
                            dotEl.classList.add('online');
                            textEl.textContent = currentLanguage === 'zh-TW' ? '線上' : 'Online';
                            break;
                        case 'offline':
                            dotEl.classList.add('offline');
                            textEl.textContent = currentLanguage === 'zh-TW' ? '離線' : 'Offline';
                            break;
                        case 'reconnecting':
                            dotEl.classList.add('reconnecting');
                            textEl.textContent = currentLanguage === 'zh-TW' ? '重新連接中' : 'Reconnecting';
                            break;
                    }
                }
            }
        }
    }
    
    showRoomCreatedToast(roomCode) {
        const toast = document.createElement('div');
        toast.innerHTML = \`
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span>🎉</span>
                <div>
                    <div style="font-weight: 600;">\${currentLanguage === 'zh-TW' ? '房間創建成功！' : 'Room created successfully!'}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">\${currentLanguage === 'zh-TW' ? '房間代碼' : 'Room Code'}: \${roomCode}</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">\${currentLanguage === 'zh-TW' ? '您已自動加入房間' : 'You have automatically joined the room'}</div>
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
            z-index: 100;
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
                // 追蹤最後一步
                if (this.gameState.moves && this.gameState.moves.length > 0) {
                    const lastMove = this.gameState.moves[this.gameState.moves.length - 1];
                    this.lastMove = { row: lastMove.position.row, col: lastMove.position.col };
                }
                this.updateGameDisplay();
                
                // 如果是AI模式，初始化AI狀態
                if (mode === 'ai') {
                    this.updateAIStatus(currentLanguage === 'zh-TW' ? '等待中' : 'Waiting');
                    this.updateAIThinkingTime('-');
                }
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
                // 追蹤最後一步
                if (this.gameState.moves && this.gameState.moves.length > 0) {
                    const lastMove = this.gameState.moves[this.gameState.moves.length - 1];
                    this.lastMove = { row: lastMove.position.row, col: lastMove.position.col };
                }
                this.updateGameDisplay();
                this.drawBoard();
                
                // 如果是AI模式，初始化AI狀態
                if (this.gameState.mode === 'ai') {
                    this.updateAIStatus(currentLanguage === 'zh-TW' ? '等待中' : 'Waiting');
                    this.updateAIThinkingTime('-');
                }
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
                // 追蹤最後一步
                if (this.gameState.moves && this.gameState.moves.length > 0) {
                    const lastMove = this.gameState.moves[this.gameState.moves.length - 1];
                    this.lastMove = { row: lastMove.position.row, col: lastMove.position.col };
                }
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
            // 顯示AI思考狀態
            this.updateAIStatus(currentLanguage === 'zh-TW' ? '思考中...' : 'Thinking...', true);
            
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
                // 追蹤最後一步
                if (this.gameState.moves && this.gameState.moves.length > 0) {
                    const lastMove = this.gameState.moves[this.gameState.moves.length - 1];
                    this.lastMove = { row: lastMove.position.row, col: lastMove.position.col };
                }
                this.updateGameDisplay();
                this.drawBoard();
                
                // 更新AI狀態和思考用時
                if (data.aiMove && data.aiMove.thinkingTime) {
                    this.updateAIStatus(currentLanguage === 'zh-TW' ? '已完成' : 'Completed', false);
                    this.updateAIThinkingTime(data.aiMove.thinkingTime);
                }
            }
        } catch (error) {
            console.error('AI 落子失敗:', error);
            this.updateAIStatus('錯誤', false);
        }
    }
    
    handleBoardClick(event) {
        if (!this.isMyTurn) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 考慮棋盤偏移，棋子中心在格子的中心位置
        // 網格從 size/2 開始，所以需要調整計算
        // 使用實際的格子大小（基於 Canvas 實際尺寸）
        const actualCellSize = rect.width / this.boardSize;
        const col = Math.round((x - actualCellSize/2) / actualCellSize);
        const row = Math.round((y - actualCellSize/2) / actualCellSize);
        
        if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
            if (!this.gameState.board[row][col]) {
                this.makeMove(row, col);
            }
        }
    }
    
    handleBoardTouch(event) {
        if (!this.isMyTurn) return;
        
        // 防止觸控時頁面滾動
        event.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const touch = event.changedTouches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // 考慮棋盤偏移，棋子中心在格子的中心位置
        // 網格從 size/2 開始，所以需要調整計算
        // 使用實際的格子大小（基於 Canvas 實際尺寸）
        const actualCellSize = rect.width / this.boardSize;
        const col = Math.round((x - actualCellSize/2) / actualCellSize);
        const row = Math.round((y - actualCellSize/2) / actualCellSize);
        
        if (event.type === 'touchstart') {
            // 觸控開始時顯示預覽效果
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                if (!this.gameState.board[row][col]) {
                    this.showTouchPreview(row, col);
                }
            }
        } else if (event.type === 'touchmove') {
            // 觸控移動時更新預覽位置
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                if (!this.gameState.board[row][col]) {
                    this.showTouchPreview(row, col);
                } else {
                    this.hideTouchPreview();
                }
            } else {
                this.hideTouchPreview();
            }
        } else if (event.type === 'touchend') {
            // 觸控結束時執行落子
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                if (!this.gameState.board[row][col]) {
                    this.hideTouchPreview();
                    this.makeMove(row, col);
                }
            } else {
                this.hideTouchPreview();
            }
        }
    }
    
    handleRoomBoardClick(event) {
        if (!this.isMyTurn || !this.myPlayer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 考慮棋盤偏移，棋子中心在格子的中心位置
        // 網格從 size/2 開始，所以需要調整計算
        // 使用實際的格子大小（基於 Canvas 實際尺寸）
        const actualCellSize = rect.width / this.boardSize;
        const col = Math.round((x - actualCellSize/2) / actualCellSize);
        const row = Math.round((y - actualCellSize/2) / actualCellSize);
        
        if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
            if (!this.gameState.board[row] || !this.gameState.board[row][col]) {
                this.makeRoomMove(row, col);
            }
        }
    }
    
    handleRoomBoardTouch(event) {
        if (!this.isMyTurn || !this.myPlayer) return;
        
        // 防止觸控時頁面滾動
        event.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const touch = event.changedTouches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // 考慮棋盤偏移，棋子中心在格子的中心位置
        // 網格從 size/2 開始，所以需要調整計算
        // 使用實際的格子大小（基於 Canvas 實際尺寸）
        const actualCellSize = rect.width / this.boardSize;
        const col = Math.round((x - actualCellSize/2) / actualCellSize);
        const row = Math.round((y - actualCellSize/2) / actualCellSize);
        
        if (event.type === 'touchstart') {
            // 觸控開始時顯示預覽效果
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                if (!this.gameState.board[row] || !this.gameState.board[row][col]) {
                    this.showTouchPreview(row, col);
                }
            }
        } else if (event.type === 'touchmove') {
            // 觸控移動時更新預覽位置
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                if (!this.gameState.board[row] || !this.gameState.board[row][col]) {
                    this.showTouchPreview(row, col);
                } else {
                    this.hideTouchPreview();
                }
            } else {
                this.hideTouchPreview();
            }
        } else if (event.type === 'touchend') {
            // 觸控結束時執行落子
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                if (!this.gameState.board[row] || !this.gameState.board[row][col]) {
                    this.hideTouchPreview();
                    this.makeRoomMove(row, col);
                }
            } else {
                this.hideTouchPreview();
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
        
        // 繪製觸控預覽
        if (this.touchPreview) {
            this.drawTouchPreview(this.touchPreview.row, this.touchPreview.col);
        }
    }
    
    drawPiece(row, col, player) {
        const ctx = this.ctx;
        const x = col * this.cellSize + this.cellSize/2;
        const y = row * this.cellSize + this.cellSize/2;
        const radius = this.cellSize/2 - 2;
        
        // 檢查是否是最後一步
        const isLastMove = this.lastMove && this.lastMove.row === row && this.lastMove.col === col;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        
        if (player === 'black') {
            ctx.fillStyle = '#2D3748';
        } else {
            ctx.fillStyle = '#FFFFFF';
        }
        
        ctx.fill();
        
        // 為最後一步添加高亮效果
        if (isLastMove) {
            // 繪製高亮圓圈
            ctx.beginPath();
            ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
            ctx.strokeStyle = '#FFD700'; // 金色高亮
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 繪製內圈高亮
            ctx.beginPath();
            ctx.arc(x, y, radius - 2, 0, 2 * Math.PI);
            ctx.strokeStyle = '#FFA500'; // 橙色內圈
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // 普通棋子邊框
            ctx.strokeStyle = '#4A5568';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    showTouchPreview(row, col) {
        // 只有當位置真正改變時才更新
        if (!this.touchPreview || this.touchPreview.row !== row || this.touchPreview.col !== col) {
            this.touchPreview = { row, col };
            this.drawBoard(); // 重新繪製棋盤以顯示預覽
        }
    }
    
    hideTouchPreview() {
        this.touchPreview = null;
        this.drawBoard(); // 重新繪製棋盤以隱藏預覽
    }
    
    drawTouchPreview(row, col) {
        const ctx = this.ctx;
        const x = col * this.cellSize + this.cellSize/2;
        const y = row * this.cellSize + this.cellSize/2;
        const radius = this.cellSize/2 - 2;
        
        // 繪製半透明的預覽棋子
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        
        // 根據當前玩家顏色設置預覽顏色
        if (this.myPlayer === 'black') {
            ctx.fillStyle = 'rgba(45, 55, 72, 0.6)'; // 半透明黑色
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // 半透明白色
        }
        
        ctx.fill();
        
        // 繪製預覽邊框
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#FF6B6B'; // 紅色邊框
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 繪製脈動效果
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    updateGameDisplay() {
        if (!this.gameState) return;
        
        // 更新當前玩家顯示
        const currentPlayerEl = document.getElementById('current-player');
        if (currentPlayerEl) {
            currentPlayerEl.textContent = this.gameState.currentPlayer === 'black' ? 
                (currentLanguage === 'zh-TW' ? '黑棋回合' : 'Black Turn') : 
                (currentLanguage === 'zh-TW' ? '白棋回合' : 'White Turn');
        }
        
        // 更新遊戲狀態
        const gameStatusEl = document.getElementById('game-status');
        if (gameStatusEl) {
            if (this.gameState.status === 'finished') {
                if (this.gameState.winner === 'draw') {
                    gameStatusEl.textContent = currentLanguage === 'zh-TW' ? '平局' : 'Draw';
                } else {
                    const winnerName = this.gameState.winner === 'black' ? 
                        (currentLanguage === 'zh-TW' ? '黑棋' : 'Black') : 
                        (currentLanguage === 'zh-TW' ? '白棋' : 'White');
                    gameStatusEl.textContent = \`\${winnerName}\${currentLanguage === 'zh-TW' ? '獲勝' : ' Wins'}\`;
                }
                
                // 顯示遊戲結束彈窗
                this.showGameOverModal();
            } else {
                gameStatusEl.textContent = currentLanguage === 'zh-TW' ? '遊戲進行中' : 'Game in Progress';
            }
        }
        
        // 更新走法記錄
        this.updateMoveHistory();
    }
    
    updateMoveHistory() {
        const movesListEl = document.getElementById('moves-list');
        if (!movesListEl || !this.gameState) return;
        
        movesListEl.innerHTML = '';
        
        // 只顯示過去5步
        const recentMoves = this.gameState.moves.slice(-5);
        const startIndex = Math.max(0, this.gameState.moves.length - 5);
        
        recentMoves.forEach((move, index) => {
            const moveEl = document.createElement('div');
            moveEl.className = 'move-item';
            moveEl.textContent = \`\${startIndex + index + 1}. \${move.player === 'black' ? (currentLanguage === 'zh-TW' ? '黑' : 'B') : (currentLanguage === 'zh-TW' ? '白' : 'W')}(\${move.position.row}, \${move.position.col})\`;
            movesListEl.appendChild(moveEl);
        });
        
        // 滾動到底部
        movesListEl.scrollTop = movesListEl.scrollHeight;
    }
    
    // 更新AI狀態
    updateAIStatus(status, isThinking = false) {
        const statusEl = document.getElementById('ai-current-status');
        if (statusEl) {
            statusEl.textContent = status;
            
            // 添加或移除思考動畫
            if (isThinking) {
                statusEl.classList.add('ai-thinking');
            } else {
                statusEl.classList.remove('ai-thinking');
            }
        }
    }
    
    // 更新AI思考用時
    updateAIThinkingTime(timeMs) {
        const timeEl = document.getElementById('ai-thinking-time');
        if (timeEl) {
            if (timeMs < 1000) {
                timeEl.textContent = \`\${timeMs}ms\`;
            } else {
                timeEl.textContent = \`\${(timeMs / 1000).toFixed(1)}s\`;
            }
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
        if (this.gameState.winner === 'draw' || this.gameState.result === 'draw') {
            titleEl.textContent = currentLanguage === 'zh-TW' ? '🤝 和棋' : '🤝 Draw';
            iconEl.textContent = '🤝';
            messageEl.textContent = currentLanguage === 'zh-TW' ? '雙方同意和棋，勢均力敵！' : 'Both players agreed to a draw!';
            modal.querySelector('.game-over-content').classList.remove('winner-effect');
        } else {
            const isPlayerWin = (this.gameState.winner === 'black' && this.myPlayer === 'black') || 
                               (this.gameState.winner === 'white' && this.myPlayer === 'white');
            
            if (this.gameState.mode === 'ai') {
                if (isPlayerWin) {
                    titleEl.textContent = currentLanguage === 'zh-TW' ? '恭喜獲勝！' : 'Congratulations!';
                    iconEl.textContent = '🎉';
                    messageEl.textContent = currentLanguage === 'zh-TW' ? '您戰勝了 AI，棋藝精湛！' : 'You defeated the AI, excellent skills!';
                    modal.querySelector('.game-over-content').classList.add('winner-effect');
                } else {
                    titleEl.textContent = currentLanguage === 'zh-TW' ? '遊戲結束' : 'Game Over';
                    iconEl.textContent = '🤖';
                    messageEl.textContent = currentLanguage === 'zh-TW' ? 'AI 獲勝，再接再厲！' : 'AI wins, keep trying!';
                    modal.querySelector('.game-over-content').classList.remove('winner-effect');
                }
            } else {
                const winnerText = this.gameState.winner === 'black' ? 
                    (currentLanguage === 'zh-TW' ? '黑棋' : 'Black') : 
                    (currentLanguage === 'zh-TW' ? '白棋' : 'White');
                titleEl.textContent = \`\${winnerText}\${currentLanguage === 'zh-TW' ? '獲勝！' : ' Wins!'}\`;
                iconEl.textContent = '👑';
                messageEl.textContent = \`\${winnerText}\${currentLanguage === 'zh-TW' ? '玩家獲得勝利！' : ' player wins!'}\`;
                modal.querySelector('.game-over-content').classList.add('winner-effect');
            }
        }
        
        // 設置統計信息
        durationEl.textContent = currentLanguage === 'zh-TW' ? 
            \`遊戲時長: \${minutes}分\${seconds}秒\` : 
            \`Game Duration: \${minutes}m\${seconds}s\`;
        movesEl.textContent = currentLanguage === 'zh-TW' ? 
            \`總步數: \${this.gameState.moves.length}步\` : 
            \`Total Moves: \${this.gameState.moves.length}\`;
        
        // 顯示彈窗
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        console.log('遊戲結束彈窗已顯示');
        
        // 直接綁定按鈕事件
        const restartBtn = document.getElementById('restart-btn');
        const homeBtn = document.getElementById('home-btn');
        const analyzeBtn = document.getElementById('analyze-btn');
        
        console.log('檢查按鈕元素:', {
            restartBtn: !!restartBtn,
            homeBtn: !!homeBtn,
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
                        greetingEl.textContent = currentLanguage === 'zh-TW' ? 
                            \`您好，\${data.user.username}\` : 
                            \`Hello, \${data.user.username}\`;
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
            const anonymousId = \`Anonymous_\${userId.slice(-6)}\`;
            greetingEl.textContent = \`\${currentLanguage === 'zh-TW' ? '您好，' : 'Hello, '}\${anonymousId}\`;
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
                <p>\${currentLanguage === 'zh-TW' ? '歡迎回來' : 'Welcome back'}，<strong>\${user.username}</strong>！</p>
                <div class="user-stats">
                    <p>\${currentLanguage === 'zh-TW' ? '評分：' : 'Rating:'}<strong>\${user.rating}</strong></p>
                    <p>勝率：<strong>\${user.wins + user.losses + user.draws > 0 ? 
                        ((user.wins / (user.wins + user.losses + user.draws)) * 100).toFixed(1) + '%' : '0%'}</strong></p>
                </div>
            \`;
            profileButton.innerHTML = \`
                <button class="btn secondary" onclick="window.location.href='/profile'">\${currentLanguage === 'zh-TW' ? '查看資料' : 'View Profile'}</button>
                <button class="btn warning" onclick="showChangePasswordModal()">\${currentLanguage === 'zh-TW' ? '更改密碼' : 'Change Password'}</button>
            \`;
            if (headerLogoutBtn) {
                headerLogoutBtn.style.display = 'inline-block';
            }
        } else {
            // 未登入用戶
            profileDescription.textContent = currentLanguage === 'zh-TW' ? '管理帳號和戰績' : 'Manage account and stats';
            profileButton.innerHTML = \`<button class="btn secondary" onclick="showLoginModal()">\${currentLanguage === 'zh-TW' ? '登入/註冊' : 'Login/Register'}</button>\`;
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
                    \${game.result === 'win' ? (currentLanguage === 'zh-TW' ? '勝利' : 'Win') : game.result === 'loss' ? (currentLanguage === 'zh-TW' ? '失敗' : 'Loss') : (currentLanguage === 'zh-TW' ? '平局' : 'Draw')}
                </div>
                <div class="game-details">
                    <p>\${currentLanguage === 'zh-TW' ? '模式' : 'Mode'}: \${game.mode === 'ai' ? (currentLanguage === 'zh-TW' ? 'AI 對戰' : 'AI Game') : (currentLanguage === 'zh-TW' ? '玩家對戰' : 'PvP Game')}</p>
                    <p>\${currentLanguage === 'zh-TW' ? '時長' : 'Duration'}: \${Math.floor(game.duration / 60000)}\${currentLanguage === 'zh-TW' ? '分' : 'm'}\${Math.floor((game.duration % 60000) / 1000)}\${currentLanguage === 'zh-TW' ? '秒' : 's'}</p>
                    <p>\${currentLanguage === 'zh-TW' ? '評分變化' : 'Rating Change'}: \${game.ratingChange > 0 ? '+' : ''}\${game.ratingChange}</p>
                </div>
                <div class="game-date">
                    \${new Date(game.createdAt).toLocaleDateString(currentLanguage === 'zh-TW' ? 'zh-TW' : 'en-US')}
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
    
    // 返回首頁功能
    goHome() {
        if (this.websocket) {
            this.websocket.close();
        }
        window.location.href = '/';
    }
}

// 全域函數
let game = new GomokuGame();

// 返回首頁的全域函數
window.goHome = function() {
    game.goHome();
};

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
                    greetingEl.textContent = currentLanguage === 'zh-TW' ? 
                        \`您好，\${data.user.username}\` : 
                        \`Hello, \${data.user.username}\`;
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
            <p>\${currentLanguage === 'zh-TW' ? '歡迎回來' : 'Welcome back'}，<strong>\${user.username}</strong>！</p>
            <div class="user-stats">
                <p>\${currentLanguage === 'zh-TW' ? '評分：' : 'Rating:'}<strong>\${user.rating}</strong></p>
                <p>\${currentLanguage === 'zh-TW' ? '勝率：' : 'Win Rate:'}<strong>\${user.wins + user.losses + user.draws > 0 ? 
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
        const anonymousId = \`Anonymous_\${userId.slice(-6)}\`;
        greetingEl.textContent = \`\${currentLanguage === 'zh-TW' ? '您好，' : 'Hello, '}\${anonymousId}\`;
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
            z-index: 100;
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
    const modal = document.getElementById('room-options');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function hideRoomOptions() {
    const modal = document.getElementById('room-options');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
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

function copyRoomUrl() {
    const roomUrlInput = document.getElementById('room-url');
    const copyBtn = document.getElementById('copy-url-btn');
    const copyIcon = document.getElementById('copy-icon');
    
    if (roomUrlInput && copyBtn && copyIcon) {
        // 選擇輸入框中的文本
        roomUrlInput.select();
        roomUrlInput.setSelectionRange(0, 99999); // 對於移動設備
        
        try {
            // Try to copy to clipboard
            document.execCommand('copy');
            
            // 更新按鈕狀態
            copyBtn.classList.add('copied');
            copyIcon.textContent = '✓';
            copyBtn.innerHTML = '<span id="copy-icon">✓</span> ' + t('copied');
            
            // 2秒後恢復原始狀態
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyIcon.textContent = '📋';
                copyBtn.innerHTML = '<span id="copy-icon">📋</span> ' + t('copyRoomUrl');
            }, 2000);
            
            // 顯示成功提示
            showToast(t('copied'), 'success');
            
        } catch (err) {
            console.error('Copy failed:', err);
            
            // 如果 execCommand 失敗，嘗試使用 Clipboard API
            if (navigator.clipboard) {
                navigator.clipboard.writeText(roomUrlInput.value).then(() => {
                    // 更新按鈕狀態
                    copyBtn.classList.add('copied');
                    copyIcon.textContent = '✓';
                    copyBtn.innerHTML = '<span id="copy-icon">✓</span> ' + t('copied');
                    
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyIcon.textContent = '📋';
                        copyBtn.innerHTML = '<span id="copy-icon">📋</span> ' + t('copyRoomUrl');
                    }, 2000);
                    
                    showToast(t('copied'), 'success');
                }).catch((clipboardErr) => {
                    console.error('Clipboard API copy failed:', clipboardErr);
                    showToast(t('copyFailed'), 'error');
                });
            } else {
                showToast(t('copyFailed'), 'error');
            }
        }
    }
}

function showLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function hideLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

function toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const emailGroup = document.getElementById('email-group');
    const emailField = document.getElementById('email');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch');
    const submitBtn = document.querySelector('#auth-form button');
    
    if (title.textContent === (currentLanguage === 'zh-TW' ? '登入' : 'Login')) {
        title.textContent = currentLanguage === 'zh-TW' ? '註冊' : 'Register';
        emailGroup.style.display = 'block';
        emailField.style.display = 'block';
        switchText.textContent = currentLanguage === 'zh-TW' ? '已有帳號？' : 'Already have an account?';
        switchLink.textContent = currentLanguage === 'zh-TW' ? '登入' : 'Login';
        submitBtn.textContent = currentLanguage === 'zh-TW' ? '註冊' : 'Register';
    } else {
        title.textContent = currentLanguage === 'zh-TW' ? '登入' : 'Login';
        emailGroup.style.display = 'none';
        emailField.style.display = 'none';
        switchText.textContent = currentLanguage === 'zh-TW' ? '還沒有帳號？' : 'No account yet?';
        switchLink.textContent = currentLanguage === 'zh-TW' ? '註冊' : 'Register';
        submitBtn.textContent = currentLanguage === 'zh-TW' ? '登入' : 'Login';
    }
}


// 表單驗證功能
function validateForm(input) {
    const formGroup = input.closest('.form-group');
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';

    // 清除之前的驗證狀態
    formGroup.classList.remove('error', 'success');
    const existingError = formGroup.querySelector('.form-error');
    if (existingError) {
        existingError.remove();
    }
    
    // 確保沒有殘留的錯誤訊息
    const errorMessages = formGroup.querySelectorAll('.form-error');
    errorMessages.forEach(msg => msg.remove());

    // 根據輸入類型進行驗證
    switch (input.type) {
        case 'email':
            // 更寬鬆的電子郵件驗證，支援更多格式
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (value && value.length > 0) {
                // 先檢查 HTML5 驗證
                if (input.validity && input.validity.valid === false) {
                    isValid = false;
                    errorMessage = '請輸入有效的電子郵件地址';
                } else if (!emailRegex.test(value)) {
                    isValid = false;
                    errorMessage = '請輸入有效的電子郵件地址';
                }
            }
            break;
        case 'password':
            if (value && value.length < 6) {
                isValid = false;
                errorMessage = '密碼至少需要6個字符';
            }
            break;
        case 'text':
            if (input.id === 'username') {
                if (value && value.length < 3) {
                    isValid = false;
                    errorMessage = '用戶名至少需要3個字符';
                }
            }
            break;
    }

    // 特殊驗證：確認密碼
    if (input.id === 'confirm-password') {
        const newPassword = document.getElementById('new-password');
        if (value && value !== newPassword.value) {
            isValid = false;
            errorMessage = '密碼確認不匹配';
        }
    }

    // 只顯示錯誤訊息，不顯示成功提示
    if (value && value.length > 0 && !isValid) {
        formGroup.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.textContent = errorMessage;
        formGroup.appendChild(errorDiv);
    } else if (isValid) {
        formGroup.classList.add('success');
    }

    return isValid;
}

function restartGame() {
    // 隱藏彈窗
    const modal = document.getElementById('game-over-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
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
        document.body.classList.remove('modal-open');
    }
    
    // If in a room, send leave message first
    if (game && game.websocket && window.location.pathname === '/room') {
        try {
            game.websocket.send(JSON.stringify({
                type: 'leave',
                data: {},
                timestamp: Date.now()
            }));
            game.websocket.close();
        } catch (error) {
            console.log('Failed to send leave message:', error);
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
        document.body.classList.remove('modal-open');
    }
    
    // 顯示分析面板
    const analysisEl = document.getElementById('ai-analysis');
    
    if (analysisEl) {
        analysisEl.style.display = 'block';
        const contentEl = document.getElementById('analysis-content');
        if (contentEl) {
            contentEl.innerHTML = \`
                <h4>🎯 \${currentLanguage === 'zh-TW' ? '對局總結' : 'Game Summary'}</h4>
                <p><strong>\${currentLanguage === 'zh-TW' ? '遊戲結果：' : 'Game Result:'}</strong>\${game.gameState.winner === 'draw' ? (currentLanguage === 'zh-TW' ? '平局' : 'Draw') : 
                    (game.gameState.winner === 'black' ? (currentLanguage === 'zh-TW' ? '黑棋獲勝' : 'Black Wins') : (currentLanguage === 'zh-TW' ? '白棋獲勝' : 'White Wins'))}</p>
                <p><strong>\${currentLanguage === 'zh-TW' ? '總步數：' : 'Total Moves:'}</strong>\${game.gameState.moves.length} \${currentLanguage === 'zh-TW' ? '步' : 'moves'}</p>
                <p><strong>\${currentLanguage === 'zh-TW' ? '遊戲時長：' : 'Game Duration:'}</strong>\${Math.floor((game.gameState.updatedAt - game.gameState.createdAt) / 60000)}\${currentLanguage === 'zh-TW' ? '分鐘' : ' minutes'}</p>
                <hr style="margin: 1rem 0;">
                <p>🔍 <strong>\${currentLanguage === 'zh-TW' ? '棋局分析：' : 'Game Analysis:'}</strong></p>
                <p>• \${currentLanguage === 'zh-TW' ? '這是一局精彩的對戰' : 'This was an exciting game'}</p>
                <p>• \${currentLanguage === 'zh-TW' ? '雙方都展現了不錯的棋藝' : 'Both players showed good skills'}</p>
                <p>• \${currentLanguage === 'zh-TW' ? '關鍵轉折點在中盤階段' : 'Key turning point was in the middle game'}</p>
            \`;
        }
    }
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !game.websocket) return;
    
    const message = chatInput.value.trim();
    if (message.length === 0) return;
    
    // 立即在本地顯示自己的訊息
    const currentUserId = game.getCurrentUserId();
    game.displayChatMessage({
        userId: currentUserId.startsWith('Anonymous_') ? currentUserId : \`\${currentLanguage === 'zh-TW' ? '玩家' : 'Player'} \${currentUserId.slice(-6)}\`,
        message: message
    });
    
    // 發送聊天訊息到其他玩家
    game.websocket.send(JSON.stringify({
        type: 'chat',
        data: { message },
        timestamp: Date.now()
    }));
    
    // 清空輸入框
    chatInput.value = '';
}

function leaveRoom() {
    console.log('Attempting to leave room');
    
    // 隱藏彈窗（如果有的話）
    const modal = document.getElementById('game-over-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
    
    if (confirm(currentLanguage === 'zh-TW' ? '確定要離開房間嗎？' : 'Are you sure you want to leave the room?')) {
        if (game && game.websocket) {
            try {
                console.log('發送離開房間訊息');
                
                // 先發送離開訊息，讓後端處理
                game.websocket.send(JSON.stringify({
                    type: 'leave',
                    data: {},
                    timestamp: Date.now()
                }));
                
                // 短暫延遲後關閉WebSocket，讓後端有時間處理離開訊息
                setTimeout(() => {
                    console.log('關閉WebSocket連接');
                    game.websocket.close(1000, 'User left room');
                    game.websocket = null;
                }, 100);
                
            } catch (error) {
                console.log('Failed to send leave message:', error);
                // 即使發送失敗，也要關閉WebSocket
                if (game.websocket) {
                    game.websocket.close();
                    game.websocket = null;
                }
            }
        }
        
        // 顯示離開提示
        showToast(
            currentLanguage === 'zh-TW' ? '已離開房間' : 'Left room', 
            'info'
        );
        
        console.log('Leaving room, returning to home page');
        
        // 延遲後返回首頁，確保WebSocket關閉完成
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    }
}

// 和棋功能
function requestDraw() {
    if (!game || !game.websocket) {
        showToast(
            currentLanguage === 'zh-TW' ? '連接已斷開' : 'Connection lost', 
            'error'
        );
        return;
    }
    
    if (confirm(currentLanguage === 'zh-TW' ? '確定要提議和棋嗎？' : 'Are you sure you want to request a draw?')) {
        try {
            game.websocket.send(JSON.stringify({
                type: 'drawRequest',
                data: {},
                timestamp: Date.now()
            }));
            
            showToast(
                currentLanguage === 'zh-TW' ? '已發送和棋請求' : 'Draw request sent', 
                'info'
            );
        } catch (error) {
            console.error('發送和棋請求失敗:', error);
            showToast(
                currentLanguage === 'zh-TW' ? '發送失敗，請重試' : 'Failed to send, please try again', 
                'error'
            );
        }
    }
}

// 回應和棋請求
function respondToDraw(accept) {
    if (!game || !game.websocket) {
        showToast(
            currentLanguage === 'zh-TW' ? '連接已斷開' : 'Connection lost', 
            'error'
        );
        return;
    }
    
    try {
        game.websocket.send(JSON.stringify({
            type: 'drawResponse',
            data: { accept },
            timestamp: Date.now()
        }));
        
        const message = accept 
            ? (currentLanguage === 'zh-TW' ? '已接受和棋' : 'Draw accepted')
            : (currentLanguage === 'zh-TW' ? '已拒絕和棋' : 'Draw rejected');
        
        showToast(message, accept ? 'success' : 'info');
    } catch (error) {
        console.error('回應和棋請求失敗:', error);
        showToast(
            currentLanguage === 'zh-TW' ? '回應失敗，請重試' : 'Failed to respond, please try again', 
            'error'
        );
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

    // 表單驗證事件監聽器
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        const inputs = authForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateForm(this);
            });
            input.addEventListener('input', function() {
                // 清除錯誤狀態當用戶開始輸入
                const formGroup = this.closest('.form-group');
                formGroup.classList.remove('error');
                const errorDiv = formGroup.querySelector('.form-error');
                if (errorDiv) errorDiv.remove();
            });
        });
    }

    // 更改密碼表單驗證
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        const inputs = changePasswordForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateForm(this);
            });
            input.addEventListener('input', function() {
                const formGroup = this.closest('.form-group');
                formGroup.classList.remove('error');
                const errorDiv = formGroup.querySelector('.form-error');
                if (errorDiv) errorDiv.remove();
            });
        });
    }
    
    // 移除事件委託，改用直接綁定
    if (authForm) {
        authForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const isLogin = document.getElementById('auth-title').textContent === (currentLanguage === 'zh-TW' ? '登入' : 'Login');
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
                    alert(\`\${isLogin ? (currentLanguage === 'zh-TW' ? '登入' : 'Login') : (currentLanguage === 'zh-TW' ? '註冊' : 'Register')}成功！\`);
                    
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
                    alert(data.error || \`\${isLogin ? (currentLanguage === 'zh-TW' ? '登入' : 'Login') : (currentLanguage === 'zh-TW' ? '註冊' : 'Register')}失敗\`);
                }
            } catch (error) {
                console.error(\`\${isLogin ? (currentLanguage === 'zh-TW' ? '登入' : 'Login') : (currentLanguage === 'zh-TW' ? '註冊' : 'Register')}失敗:\`, error);
                alert(\`\${isLogin ? (currentLanguage === 'zh-TW' ? '登入' : 'Login') : (currentLanguage === 'zh-TW' ? '註冊' : 'Register')}失敗\`);
            }
        });
    }
    
    // 更改密碼表單處理
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
                    alert(currentLanguage === 'zh-TW' ? '密碼更改成功！' : 'Password changed successfully!');
                    hideChangePasswordModal();
                } else {
                    alert(data.error || (currentLanguage === 'zh-TW' ? '密碼更改失敗' : 'Failed to change password'));
                }
            } catch (error) {
                console.error('更改密碼失敗:', error);
                alert(currentLanguage === 'zh-TW' ? '更改密碼失敗' : 'Failed to change password');
            }
        });
    }
    
    // 登出功能
    window.logout = function() {
        if (confirm(currentLanguage === 'zh-TW' ? '確定要登出嗎？' : 'Are you sure you want to logout?')) {
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
            document.body.classList.add('modal-open');
        }
    };
    
    // 隱藏更改密碼彈窗
    window.hideChangePasswordModal = function() {
        const modal = document.getElementById('change-password-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            // 清空表單
            document.getElementById('change-password-form').reset();
        }
    };
});`;
}

