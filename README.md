# ♟️ OmniAI 五子棋 - Cloudflare Workers AI

一個功能完整的 OmniAI 五子棋遊戲，運行在 Cloudflare Workers 平台上，整合了多項 AI 功能。

## ✨ 功能特色

### 🎮 遊戲模式
- **AI 對戰**: 與智能 AI 對戰，支援三種難度等級（簡單/中等/困難）
- **玩家對戰**: 透過 4 位房間代碼與朋友即時對戰
- **觀戰模式**: 觀看其他玩家的對戰過程

### 🤖 AI 功能
- **Workers AI Text Generation**: 基於 Llama 模型的智能思考引擎
- **Text Classification**: 自動判斷局面優劣勢和勝率
- **Text Embeddings**: 局面相似度比較和歷史建議
- **Vectorize**: 向量化棋譜資料庫，增強 AI 判斷能力
- **局面分析**: 即時分析當前棋局形勢

### 🏠 房間系統
- **Durable Objects**: 基於 Cloudflare 的即時多人對戰房間
- **4 位隨機房間代碼**: 簡單易記，方便分享和加入
- **即時通訊**: WebSocket 支援聊天和觀戰
- **自動重連**: 網路斷線自動重連機制

### 👤 用戶系統
- **D1 資料庫**: 安全的用戶帳號和戰績管理
- **ELO 評分系統**: 公平的棋力評分算法
- **全球排行榜**: 實時更新的玩家排名
- **遊戲歷史**: 完整的對局記錄和統計
- **匿名玩家**: 支援匿名對戰，自動生成用戶名

### 🎨 用戶體驗
- **響應式設計**: 適配桌面和行動裝置
- **現代化 UI**: 簡潔美觀的介面設計
- **即時反饋**: 流暢的動畫和視覺效果
- **無障礙支援**: 符合 Web 無障礙標準

## 🏗️ 技術架構

### 後端技術
- **Cloudflare Workers**: 無伺服器運算平台，全球邊緣計算
- **TypeScript**: 類型安全的開發體驗，提升程式碼品質
- **Durable Objects**: 有狀態的即時服務，支援多人對戰
- **D1 資料庫**: SQLite 兼容的無伺服器資料庫，持久化存儲
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

4. **一鍵部署**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

### 手動部署

如果自動部署腳本無法運行，可以手動執行以下步驟：

1. **創建 D1 資料庫**
   ```bash
   wrangler d1 create gomoku-db
   ```

2. **更新 wrangler.toml**
   將生成的 database_id 填入 wrangler.toml 文件中

3. **執行資料庫遷移**
   ```bash
   wrangler d1 migrations apply gomoku-db --remote
   ```

4. **創建 Vectorize 索引**
   ```bash
   wrangler vectorize create gomoku-games --dimensions=384 --metric=cosine
   ```

5. **部署 Worker**
   ```bash
   wrangler deploy
   ```

## 📚 API 文檔

### 遊戲 API

- \`POST /api/game/create\` - 創建新遊戲
- \`POST /api/game/move\` - 執行落子
- \`POST /api/game/ai-move\` - 請求 AI 落子
- \`POST /api/game/analyze\` - 分析局面
- \`GET /api/game/state/:id\` - 獲取遊戲狀態
- \`GET /api/game/suggestions\` - 獲取走法建議
- \`POST /api/game/save-record\` - 保存遊戲記錄

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

```bash
# 啟動開發伺服器
npm run dev

# 編譯 TypeScript
npm run build

# 代碼檢查
npm run lint

# 代碼格式化
npm run format
```

### 資料庫管理

```bash
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
# 查看索引信息
wrangler vectorize get gomoku-games

# 插入向量數據
wrangler vectorize insert gomoku-games --file=vectors.json

# 查詢相似向量
wrangler vectorize query gomoku-games --vector="[0.1, 0.2, ...]"
```

## 📁 專案結構

```
gomoku-cf/
├── src/                     # 原始碼目錄
│   ├── ai/                  # AI 相關功能
│   │   ├── AIEngine.ts      # AI 引擎核心
│   │   └── VectorizeService.ts # 向量化服務
│   ├── database/            # 資料庫服務
│   │   └── UserService.ts   # 用戶資料管理
│   ├── durable-objects/     # Durable Objects
│   │   └── GameRoom.ts      # 遊戲房間實例
│   ├── game/                # 遊戲核心邏輯
│   │   └── GameLogic.ts     # 五子棋遊戲規則
│   ├── handlers/            # API 路由處理器
│   │   ├── game.ts          # 遊戲相關 API
│   │   ├── gameRecord.ts    # 遊戲記錄處理
│   │   ├── room.ts          # 房間管理 API
│   │   ├── static.ts        # 靜態資源服務
│   │   └── user.ts          # 用戶管理 API
│   ├── utils/               # 工具函數
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
├── deploy.sh                # Linux/macOS 部署腳本
├── deploy.cmd               # Windows 部署腳本
├── QUICKSTART.md            # 快速開始指南
└── README.md                # 專案說明文檔
```

## 🌟 功能亮點

### 智能 AI 系統
- **多模型整合**: 使用 Workers AI 的 Llama 模型進行深度思考
- **混合策略**: 結合傳統 Minimax 算法和機器學習技術
- **即時分析**: 支援局面分析和優劣勢判斷
- **難度分級**: 三種 AI 難度等級，適合不同水平玩家

### 向量化棋譜資料庫
- **智能向量化**: 將棋盤狀態轉換為 384 維向量
- **快速檢索**: 基於餘弦相似度的快速檢索
- **歷史建議**: 提供相似局面的歷史棋譜建議
- **持續學習**: 每次對局都會更新向量資料庫

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