# 🚀 快速開始指南

## 1. 環境準備

### 必要工具
- Node.js 18+ 
- npm 或 yarn
- Cloudflare 帳號

### 安裝 Wrangler CLI
```bash
npm install -g wrangler
```

### 登入 Cloudflare
```bash
wrangler login
```

## 2. 專案設置

### 安裝依賴
```bash
npm install
```

### 編譯 TypeScript
```bash
npx tsc
```

## 3. 一鍵部署

### Linux/macOS
```bash
chmod +x deploy.sh
./deploy.sh
```

### Windows
```cmd
deploy.cmd
```

## 4. 手動部署步驟

如果自動部署失敗，請按照以下步驟手動部署：

### 4.1 創建 D1 資料庫
```bash
wrangler d1 create gomoku-db
```

複製輸出中的 `database_id`，並更新 `wrangler.toml` 文件中的對應欄位。

### 4.2 執行資料庫遷移
```bash
wrangler d1 migrations apply gomoku-db --remote
```

### 4.3 創建 Vectorize 索引
```bash
wrangler vectorize create gomoku-games --dimensions=384 --metric=cosine
```

### 4.4 部署 Worker
```bash
wrangler deploy
```

## 5. 驗證部署

### 檢查服務狀態
1. 訪問您的 Worker URL
2. 測試 AI 對戰功能
3. 嘗試創建和加入房間
4. 註冊用戶並查看排行榜

### 監控日誌
```bash
wrangler tail
```

## 6. 常見問題

### Q: 部署時提示權限錯誤
A: 確保已正確登入 Cloudflare 並有相應的權限。

### Q: D1 資料庫連接失敗
A: 檢查 `wrangler.toml` 中的 `database_id` 是否正確。

### Q: Vectorize 索引無法創建
A: 確保您的 Cloudflare 帳號已啟用 Vectorize 功能。

### Q: Workers AI 調用失敗
A: 檢查是否已啟用 Workers AI 服務。

## 7. 本地開發

### 啟動開發伺服器
```bash
wrangler dev
```

### 本地資料庫測試
```bash
wrangler d1 migrations apply gomoku-db --local
```

## 8. 更新和維護

### 更新代碼
```bash
git pull
npm install
wrangler deploy
```

### 資料庫遷移
```bash
wrangler d1 migrations create gomoku-db <migration-name>
wrangler d1 migrations apply gomoku-db --remote
```

---

🎮 **祝您使用愉快！如有問題請查看完整的 README.md 文檔。**
