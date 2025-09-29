# ♟️ OmniAI 五子棋 - Cloudflare Workers AI

一個功能完整的 OmniAI 五子棋遊戲，運行在 Cloudflare Workers 平台上，整合了多項 AI 功能。

🌐 **遊戲網址**: [https://gomoku-cf.omni-worker.workers.dev/](https://gomoku-cf.omni-worker.workers.dev/)

## ✨ 功能特色

### 🎮 遊戲模式
- **AI 對戰**: 與智能 AI 對戰，支援三種難度等級（簡單/中等/困難）
- **玩家對戰**: 透過 4 位房間代碼與朋友即時對戰
- **觀戰模式**: 觀看其他玩家的對戰過程

### 🤖 AI 功能
- **智能思考引擎**: 基於 Workers AI 的深度學習模型
- **向量化棋譜**: 使用 Vectorize 儲存和檢索歷史棋譜
- **多層決策**: 結合傳統算法、AI分析和歷史資料
- **性能優化**: 分級超時控制，簡單模式 < 5秒，困難模式 < 20秒
- **AI狀態顯示**: 即時顯示AI思考狀態和思考用時

### 🏠 房間系統
- **Durable Objects**: 基於 Cloudflare 的即時多人對戰房間
- **4 位隨機房間代碼**: 簡單易記，方便分享和加入
- **即時通訊**: WebSocket 支援聊天
- **自動重連**: 網路斷線自動重連機制

### 👤 用戶系統
- **D1 資料庫**: 安全的用戶帳號和戰績管理
- **ELO 評分系統**: 公平的棋力評分算法
- **全球排行榜**: 實時更新的玩家排名
- **遊戲歷史**: 完整的對局記錄和統計
- **匿名玩家**: 支援匿名對戰，自動生成用戶名

### 🎨 用戶體驗
- **響應式設計**: 適配桌面和行動裝置
- **現代化 UI**: 簡潔美觀的介面設計，白色主題風格
- **即時反饋**: 流暢的動畫和視覺效果
- **AI狀態面板**: 顯示AI思考狀態和用時統計
- **無障礙支援**: 符合 Web 無障礙標準

## 🏗️ 技術架構

### 後端技術
- **Cloudflare Workers**: 無伺服器運算平台，全球邊緣計算
- **TypeScript**: 類型安全的開發體驗，提升程式碼品質
- **Durable Objects**: 有狀態的即時服務，支援多人對戰
- **D1 資料庫**: SQLite 兼容的無伺服器資料庫，持久化存儲
- **KV 存儲**: 鍵值對存儲服務，用於管理員配置和快取
- **Vectorize**: 向量資料庫服務，AI 相似度檢索
- **Workers AI**: 內建 AI 模型服務，智能對戰引擎
- **靜態資源**: 自動 CDN 分發，全球加速

### 前端技術
- **原生 JavaScript**: 無框架依賴，輕量級實現
- **Canvas API**: 高性能棋盤繪製，流暢動畫
- **WebSocket**: 即時通訊，低延遲對戰
- **現代 CSS**: 響應式設計，適配各種裝置
- **HTML5**: 語義化標記，無障礙支援

### 開發工具
- **Wrangler CLI**: Cloudflare 開發和部署工具
- **ESLint**: 程式碼品質檢查
- **Prettier**: 程式碼格式化
- **Git**: 版本控制

## 🚀 快速開始

### 前置需求
- Node.js 18+
- Cloudflare 帳號
- Wrangler CLI

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone <repository-url>
   cd gomoku-cf
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **登入 Cloudflare**
   ```bash
   wrangler login
   ```

4. **手動部署**

執行以下步驟進行部署：

1. **創建 D1 資料庫**
   ```bash
   wrangler d1 create gomoku-db
   ```

2. **創建 KV 命名空間**
   ```bash
   wrangler kv:namespace create "gomoku_admin"
   ```

3. **更新 wrangler.toml**
   將生成的 database_id 和 kv namespace id 填入 wrangler.toml 文件中

4. **執行資料庫遷移**
   ```bash
   wrangler d1 migrations apply gomoku-db --remote
   ```

5. **創建 Vectorize 索引**
   ```bash
   wrangler vectorize create gomoku-games --dimensions=768 --metric=cosine
   ```

6. **部署 Worker**
   ```bash
   wrangler deploy
   ```

## 📚 API 文檔

### 🎮 遊戲 API (`/api/game`)

| 方法 | 端點 | 功能 | 認證 |
|------|------|------|------|
| `POST` | `/api/game/create` | 創建新遊戲 | ❌ |
| `POST` | `/api/game/move` | 執行落子 | ❌ |
| `POST` | `/api/game/ai-move` | AI 落子 | ❌ |
| `GET` | `/api/game/state/:id` | 獲取遊戲狀態 | ❌ |

**請求範例：**
```json
// POST /api/game/create
{
  "mode": "ai" | "pvp",
  "userId": "string"
}

// POST /api/game/move
{
  "gameId": "string",
  "position": { "row": number, "col": number },
  "player": "black" | "white"
}

// POST /api/game/ai-move
{
  "gameId": "string",
  "difficulty": "easy" | "medium" | "hard"
}

// 回應範例
{
  "gameState": { ... },
  "aiMove": {
    "position": { "row": 7, "col": 7 },
    "reasoning": "在 (7, 7) 落子",
    "confidence": 0.85,
    "thinkingTime": 3250
  }
}
```

### 👤 用戶 API (`/api/user`)

| 方法 | 端點 | 功能 | 認證 |
|------|------|------|------|
| `POST` | `/api/user/register` | 用戶註冊 | ❌ |
| `POST` | `/api/user/login` | 用戶登入 | ❌ |
| `POST` | `/api/user/change-password` | 更改密碼 | ✅ |
| `GET` | `/api/user/profile/:id` | 獲取用戶資料 | ❌ |
| `GET` | `/api/user/leaderboard` | 獲取排行榜 | ❌ |
| `GET` | `/api/user/history/:id` | 獲取遊戲歷史 | ❌ |
| `GET` | `/api/user/stats/:id` | 獲取用戶統計 | ❌ |
| `GET` | `/api/user/search` | 搜索用戶 | ❌ |
| `GET` | `/api/user/me` | 獲取當前用戶 | ✅ |

**請求範例：**
```json
// POST /api/user/register
{
  "username": "string",
  "email": "string?",
  "password": "string?"
}

// POST /api/user/login
{
  "username": "string",
  "password": "string"
}

// GET /api/user/leaderboard?limit=10
// GET /api/user/search?q=username&limit=10
```

### 🏠 房間 API (`/api/room`)

| 方法 | 端點 | 功能 | 認證 |
|------|------|------|------|
| `POST` | `/api/room/create` | 創建房間 | ❌ |
| `POST` | `/api/room/join` | 加入房間 | ❌ |
| `GET` | `/api/room/:code` | 獲取房間信息 | ❌ |
| `GET` | `/api/room/:code/websocket` | WebSocket 連接 | ❌ |
| `GET` | `/api/room/:code/stats` | 獲取房間統計 | ❌ |
| `POST` | `/api/room/:code/cleanup` | 手動清理房間 | ❌ |

**請求範例：**
```json
// POST /api/room/create
{
  "mode": "pvp" | "ai",
  "userId": "string"
}

// POST /api/room/join
{
  "roomCode": "string",
  "userId": "string"
}
```

### 🔧 管理員 API (`/api/admin`)

| 方法 | 端點 | 功能 | 認證 |
|------|------|------|------|
| `GET` | `/api/admin/rooms` | 獲取所有房間 | ✅ |
| `GET` | `/api/admin/rooms/active` | 獲取活躍房間 | ✅ |
| `GET` | `/api/admin/rooms/idle` | 獲取閒置房間 | ✅ |
| `GET` | `/api/admin/rooms/stats` | 獲取房間統計 | ✅ |
| `GET` | `/api/admin/rooms/:code` | 獲取房間詳情 | ✅ |
| `POST` | `/api/admin/rooms/cleanup` | 清理所有閒置房間 | ✅ |
| `POST` | `/api/admin/rooms/:code/cleanup` | 清理特定房間 | ✅ |
| `POST` | `/api/admin/database/clear` | 清空資料庫 | ✅ |
| `POST` | `/api/admin/password/set` | 設置管理員密碼 | ✅ |

**認證方式：**
```
Authorization: Bearer <admin_token>
```

### 📊 遊戲記錄 API (`/api/gameRecord`)

| 方法 | 端點 | 功能 | 認證 |
|------|------|------|------|
| `GET` | `/api/gameRecord/:id` | 獲取遊戲記錄 | ❌ |
| `GET` | `/api/gameRecord/user/:userId` | 獲取用戶遊戲記錄 | ❌ |
| `POST` | `/api/gameRecord/save` | 保存遊戲記錄 | ❌ |

### 🌐 靜態資源 API

| 方法 | 端點 | 功能 | 認證 |
|------|------|------|------|
| `GET` | `/` | 首頁 | ❌ |
| `GET` | `/game` | 遊戲頁面 | ❌ |
| `GET` | `/room` | 房間頁面 | ❌ |
| `GET` | `/profile` | 個人資料頁面 | ❌ |
| `GET` | `/leaderboard` | 排行榜頁面 | ❌ |
| `GET` | `/app.js` | 應用程式 JavaScript | ❌ |
| `GET` | `/styles.css` | 樣式表 | ❌ |
| `GET` | `/favicon.ico` | 網站圖標 | ❌ |

### ⏰ 定時任務

| 任務 | 頻率 | 功能 |
|------|------|------|
| `handleHourlyCleanup` | 每小時 | 清理閒置房間 |
| `handleDailyCleanup` | 每天 | 深度清理任務 |

## 🎯 遊戲規則

### 基本規則
- 棋盤大小：15×15
- 獲勝條件：連成 5 子
- 黑棋先手

### AI 難度等級
- **簡單**: 思考時間 < 5秒，結合快速分析和歷史建議
- **中等**: 思考時間 < 10秒，平衡深度分析和效率
- **困難**: 思考時間 < 20秒，深度AI分析和完整向量檢索

### 評分系統
- 採用 ELO 評分算法
- 初始評分：1200
- K 因子：32

## 🔧 開發指南

### 資料庫管理

```bash
# 創建 D1 資料庫
npm run db:create

# 執行資料庫遷移
npm run db:migrate

# 創建新遷移
wrangler d1 migrations create gomoku-db <migration-name>

# 執行遷移（本地）
wrangler d1 migrations apply gomoku-db --local

# 執行遷移（遠程）
wrangler d1 migrations apply gomoku-db --remote

# 查詢資料庫
wrangler d1 execute gomoku-db --command="SELECT * FROM users LIMIT 10"
```

### Vectorize 管理

```bash
# 創建 Vectorize 索引
npm run vectorize:create

# 查看索引信息
wrangler vectorize get gomoku-games

# 插入向量數據
wrangler vectorize insert gomoku-games --file=vectors.json

# 查詢相似向量
wrangler vectorize query gomoku-games --vector="[0.1, 0.2, ...]"
```

### KV 存儲管理

```bash
# 創建 KV 命名空間
wrangler kv:namespace create "gomoku_admin"

# 列出所有 KV 命名空間
wrangler kv:namespace list

# 查看 KV 中的鍵值對
wrangler kv:key list --binding=gomoku_admin

# 設置 KV 值
wrangler kv:key put "key" "value" --binding=gomoku_admin

# 獲取 KV 值
wrangler kv:key get "key" --binding=gomoku_admin

# 刪除 KV 值
wrangler kv:key delete "key" --binding=gomoku_admin
```

## 📁 專案結構

```
gomoku-cf/
├── src/                     # 原始碼目錄
│   ├── ai/                  # AI 相關功能
│   │   ├── AIEngine.ts      # AI 引擎核心
│   │   └── VectorizeService.ts # 向量化服務
│   ├── database/            # 資料庫服務
│   │   ├── RoomService.ts   # 房間資料管理
│   │   └── UserService.ts   # 用戶資料管理
│   ├── durable-objects/     # Durable Objects
│   │   └── GameRoom.ts      # 遊戲房間實例
│   ├── game/                # 遊戲核心邏輯
│   │   └── GameLogic.ts     # 五子棋遊戲規則
│   ├── handlers/            # API 路由處理器
│   │   ├── admin.ts         # 管理員 API
│   │   ├── cron.ts          # 定時任務處理
│   │   ├── game.ts          # 遊戲相關 API
│   │   ├── gameRecord.ts    # 遊戲記錄處理
│   │   ├── room.ts          # 房間管理 API
│   │   ├── static.ts        # 靜態資源服務
│   │   └── user.ts          # 用戶管理 API
│   ├── utils/               # 工具函數
│   │   ├── auth.ts          # 身份驗證工具
│   │   └── cors.ts          # CORS 跨域設定
│   ├── types.ts             # TypeScript 類型定義
│   └── index.ts             # 應用程式主入口
├── public/                  # 靜態資源目錄
│   └── logo.png             # 應用程式 Logo
├── migrations/              # 資料庫遷移檔案
│   └── 0001_initial.sql     # 初始資料庫結構
├── dist/                    # 編譯輸出目錄
│   └── ...                  # TypeScript 編譯結果
├── wrangler.toml            # Cloudflare Workers 配置
├── package.json             # Node.js 專案配置
├── tsconfig.json            # TypeScript 編譯配置
├── worker-configuration.d.ts # Workers 類型定義
├── .eslintrc.js             # ESLint 配置
├── .prettierrc              # Prettier 配置
├── .gitignore               # Git 忽略檔案
└── README.md                # 專案說明文檔
```

## 🚀 最新功能更新

### AI 系統優化 (v2.0)
- **向量資料庫整合**: AI現在會調用向量資料庫的歷史棋譜資料
- **思考時間優化**: 
  - 簡單模式：< 5秒
  - 中等模式：< 10秒  
  - 困難模式：< 20秒
- **AI狀態面板**: 新增AI思考狀態顯示，包含思考用時統計
- **性能提升**: 優化AI分析流程，提升響應速度
- **UI改進**: 採用白色主題風格，更加簡潔美觀

### 移除功能
- 移除了詳細的AI分析顯示（前端）
- 簡化了AI落子理由生成
- 優化了API端點，移除了不必要的分析功能

## 🌟 功能亮點

### 智能 AI 系統
- **深度學習引擎**: 使用 Workers AI 的深度學習模型進行智能分析
- **向量化棋譜**: 整合 Vectorize 向量資料庫，提供歷史棋譜建議
- **混合決策**: 結合傳統算法、AI分析和歷史資料的綜合決策
- **性能優化**: 分級超時控制，確保響應速度
- **即時狀態**: 顯示AI思考狀態和用時統計

### 向量化棋譜資料庫
- **智能向量化**: 將棋盤狀態轉換為 768 維向量
- **快速檢索**: 基於餘弦相似度的快速檢索
- **歷史建議**: 提供相似局面的歷史棋譜建議
- **持續學習**: 每次對局都會更新向量資料庫
- **AI整合**: AI決策時會參考歷史棋譜資料

### 即時多人對戰
- **Durable Objects**: 基於 Cloudflare 的分散式房間系統
- **WebSocket 通訊**: 低延遲的即時通訊
- **聊天功能**: 支援玩家間即時聊天
- **觀戰模式**: 支援觀看其他玩家對戰

### 完整用戶系統
- **安全認證**: 基於 D1 資料庫的安全用戶認證
- **ELO 評分**: 公平的棋力評分系統
- **詳細統計**: 勝率、評分變化、對局時長等統計
- **全球排行榜**: 實時更新的全球玩家排名
- **匿名支援**: 支援匿名對戰，自動生成用戶名
- **管理員配置**: 基於 KV 存儲的管理員設定和系統快取

### 現代化技術棧
- **無伺服器架構**: 基於 Cloudflare Workers 的無伺服器架構
- **全球 CDN**: 靜態資源全球 CDN 加速
- **類型安全**: 完整的 TypeScript 類型定義
- **自動部署**: 支援 CI/CD 自動部署流程

## 🔍 監控和除錯

### 查看日誌
```bash
wrangler tail
```

### 性能監控
- Cloudflare Analytics
- Workers Analytics
- D1 Analytics

### 除錯技巧
- 使用 console.log 進行日誌記錄
- 利用 Wrangler 的本地開發環境
- 檢查 Cloudflare Dashboard 的錯誤報告

## 🤝 貢獻指南

歡迎提交 Pull Request 或 Issue！

1. Fork 專案
2. 創建功能分支
3. 提交變更
4. 推送到分支
5. 創建 Pull Request

## 📄 授權協議

MIT License

## 🙏 致謝

感謝 Cloudflare 提供強大的無伺服器平台和 AI 服務，讓這個專案成為可能。

---

🎮 **現在就開始您的五子棋之旅吧！**