# 🔴 五子棋遊戲 - Cloudflare Workers AI

一個功能完整的五子棋遊戲，運行在 Cloudflare Workers 平台上，整合了多項 AI 功能。

## ✨ 功能特色

### 🎮 遊戲模式
- **AI 對戰**: 與智能 AI 對戰，支援多種難度等級
- **玩家對戰**: 透過房間代碼與朋友即時對戰

### 🤖 AI 功能
- **Workers AI Text Generation**: 智能 AI 思考引擎
- **Text Classification**: 自動判斷局面優劣勢
- **Text Embeddings**: 局面相似度比較
- **Vectorize**: 儲存所有對局資料，增強 AI 判斷能力

### 🏠 房間系統
- **Durable Objects**: 即時多人對戰房間
- **4 位隨機房間代碼**: 方便分享和加入

### 👤 用戶系統
- **D1 資料庫**: 用戶帳號和戰績管理
- **評分系統**: ELO 評分算法
- **排行榜**: 全球玩家排名
- **遊戲歷史**: 完整的對局記錄

## 🏗️ 技術架構

### 後端技術
- **Cloudflare Workers**: 無伺服器運算平台
- **TypeScript**: 類型安全的開發體驗
- **Durable Objects**: 有狀態的即時服務
- **D1 資料庫**: SQLite 兼容的無伺服器資料庫
- **Vectorize**: 向量資料庫服務
- **Workers AI**: 內建 AI 模型服務

### 前端技術
- **原生 JavaScript**: 無框架依賴
- **Canvas API**: 高性能棋盤繪製
- **WebSocket**: 即時通訊
- **現代 CSS**: 響應式設計

## 🚀 快速開始

### 前置需求
- Node.js 18+
- Cloudflare 帳號
- Wrangler CLI

### 安裝步驟

1. **克隆專案**
   \`\`\`bash
   git clone <repository-url>
   cd gomoku-cf
   \`\`\`

2. **安裝依賴**
   \`\`\`bash
   npm install
   \`\`\`

3. **登入 Cloudflare**
   \`\`\`bash
   wrangler login
   \`\`\`

4. **一鍵部署**
   \`\`\`bash
   chmod +x deploy.sh
   ./deploy.sh
   \`\`\`

### 手動部署

如果自動部署腳本無法運行，可以手動執行以下步驟：

1. **創建 D1 資料庫**
   \`\`\`bash
   wrangler d1 create gomoku-db
   \`\`\`

2. **更新 wrangler.toml**
   將生成的 database_id 填入 wrangler.toml 文件中

3. **執行資料庫遷移**
   \`\`\`bash
   wrangler d1 migrations apply gomoku-db --remote
   \`\`\`

4. **創建 Vectorize 索引**
   \`\`\`bash
   wrangler vectorize create gomoku-games --dimensions=384 --metric=cosine
   \`\`\`

5. **部署 Worker**
   \`\`\`bash
   wrangler deploy
   \`\`\`

## 📚 API 文檔

### 遊戲 API

- \`POST /api/game/create\` - 創建新遊戲
- \`POST /api/game/move\` - 執行落子
- \`POST /api/game/ai-move\` - 請求 AI 落子
- \`POST /api/game/analyze\` - 分析局面
- \`GET /api/game/state/:id\` - 獲取遊戲狀態
- \`GET /api/game/suggestions\` - 獲取走法建議

### 用戶 API

- \`POST /api/user/register\` - 用戶註冊
- \`POST /api/user/login\` - 用戶登入
- \`GET /api/user/profile/:id\` - 獲取用戶資料
- \`GET /api/user/leaderboard\` - 獲取排行榜
- \`GET /api/user/history/:id\` - 獲取遊戲歷史
- \`GET /api/user/stats/:id\` - 獲取用戶統計
- \`GET /api/user/search\` - 搜索用戶

### 房間 API

- \`POST /api/room/create\` - 創建房間
- \`POST /api/room/join\` - 加入房間
- \`GET /api/room/:code\` - 獲取房間信息
- \`WebSocket /api/room/:code/websocket\` - 房間即時通訊

## 🎯 遊戲規則

### 基本規則
- 棋盤大小：15×15
- 獲勝條件：連成 5 子
- 黑棋先手

### AI 難度等級
- **簡單**: 30% 機率選擇次優解
- **中等**: 10% 機率選擇次優解  
- **困難**: 總是選擇最優解

### 評分系統
- 採用 ELO 評分算法
- 初始評分：1200
- K 因子：32

## 🔧 開發指南

### 本地開發

\`\`\`bash
# 啟動開發伺服器
npm run dev

# 編譯 TypeScript
npm run build

# 代碼檢查
npm run lint

# 代碼格式化
npm run format
\`\`\`

### 資料庫管理

\`\`\`bash
# 創建新遷移
wrangler d1 migrations create gomoku-db <migration-name>

# 執行遷移（本地）
wrangler d1 migrations apply gomoku-db --local

# 執行遷移（遠程）
wrangler d1 migrations apply gomoku-db --remote

# 查詢資料庫
wrangler d1 execute gomoku-db --command="SELECT * FROM users LIMIT 10"
\`\`\`

### Vectorize 管理

\`\`\`bash
# 查看索引信息
wrangler vectorize get gomoku-games

# 插入向量數據
wrangler vectorize insert gomoku-games --file=vectors.json

# 查詢相似向量
wrangler vectorize query gomoku-games --vector="[0.1, 0.2, ...]"
\`\`\`

## 📁 專案結構

\`\`\`
gomoku-cf/
├── src/
│   ├── ai/                    # AI 相關功能
│   │   ├── AIEngine.ts       # AI 引擎
│   │   └── VectorizeService.ts # 向量服務
│   ├── database/             # 資料庫服務
│   │   └── UserService.ts    # 用戶服務
│   ├── durable-objects/      # Durable Objects
│   │   └── GameRoom.ts       # 遊戲房間
│   ├── game/                 # 遊戲邏輯
│   │   └── GameLogic.ts      # 五子棋邏輯
│   ├── handlers/             # API 處理器
│   │   ├── game.ts          # 遊戲 API
│   │   ├── user.ts          # 用戶 API
│   │   ├── room.ts          # 房間 API
│   │   └── static.ts        # 靜態資源
│   ├── utils/               # 工具函數
│   │   └── cors.ts          # CORS 設定
│   ├── types.ts             # 類型定義
│   └── index.ts             # 主入口
├── migrations/              # 資料庫遷移
│   └── 0001_initial.sql     # 初始結構
├── wrangler.toml           # Workers 配置
├── package.json            # 專案配置
├── tsconfig.json          # TypeScript 配置
├── deploy.sh              # 部署腳本
└── README.md              # 說明文檔
\`\`\`

## 🌟 功能亮點

### 智能 AI 系統
- 使用 Workers AI 的 Llama 模型進行思考
- 結合傳統算法和機器學習
- 支援局面分析和優劣勢判斷

### 向量化棋譜資料庫
- 將棋盤狀態轉換為向量
- 快速檢索相似局面
- 提供歷史棋譜建議

### 即時多人對戰
- 基於 Durable Objects 的房間系統
- WebSocket 即時通訊
- 支援聊天和觀戰

### 完整用戶系統
- 安全的用戶認證
- 詳細的戰績統計
- 全球排行榜

## 🔍 監控和除錯

### 查看日誌
\`\`\`bash
wrangler tail
\`\`\`

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