#!/bin/bash

# 五子棋遊戲部署腳本

echo "🚀 開始部署五子棋遊戲到 Cloudflare Workers..."

# 檢查 wrangler 是否已安裝
if ! command -v wrangler &> /dev/null; then
    echo "❌ 錯誤: wrangler 未安裝。請先安裝 wrangler CLI。"
    echo "npm install -g wrangler"
    exit 1
fi

# 檢查是否已登入 Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ 錯誤: 尚未登入 Cloudflare。請先登入。"
    echo "wrangler login"
    exit 1
fi

echo "📦 安裝依賴..."
npm install

echo "🔨 編譯 TypeScript..."
npm run build

echo "🗄️ 創建 D1 資料庫..."
DB_OUTPUT=$(wrangler d1 create gomoku-db 2>&1)
if [[ $DB_OUTPUT == *"already exists"* ]]; then
    echo "✅ D1 資料庫已存在"
else
    echo "✅ D1 資料庫創建成功"
    # 提取資料庫 ID
    DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+')
    if [ ! -z "$DB_ID" ]; then
        echo "📝 更新 wrangler.toml 中的資料庫 ID: $DB_ID"
        sed -i "s/database_id = \"\"/database_id = \"$DB_ID\"/" wrangler.toml
    fi
fi

echo "🔄 執行資料庫遷移..."
wrangler d1 migrations apply gomoku-db --remote

echo "📊 創建 Vectorize 索引..."
VECTORIZE_OUTPUT=$(wrangler vectorize create gomoku-games --dimensions=384 --metric=cosine 2>&1)
if [[ $VECTORIZE_OUTPUT == *"already exists"* ]] || [[ $VECTORIZE_OUTPUT == *"created successfully"* ]]; then
    echo "✅ Vectorize 索引已準備就緒"
else
    echo "⚠️  Vectorize 索引創建可能失敗，請手動檢查"
fi

echo "🚀 部署到 Cloudflare Workers..."
wrangler deploy

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 下一步："
echo "1. 檢查 Cloudflare Dashboard 確認所有服務正常運行"
echo "2. 測試 Workers AI 功能是否正常"
echo "3. 驗證 D1 資料庫連接"
echo "4. 確認 Vectorize 索引運作正常"
echo ""
echo "🔗 相關連結："
echo "• Workers Dashboard: https://dash.cloudflare.com/workers"
echo "• D1 Dashboard: https://dash.cloudflare.com/d1"
echo "• Vectorize Dashboard: https://dash.cloudflare.com/vectorize"
echo ""
echo "🎮 現在可以開始使用五子棋遊戲了！"
