@echo off
REM OmniAI 五子棋遊戲部署腳本 (Windows 版本)

echo 🚀 開始部署 OmniAI 五子棋遊戲到 Cloudflare Workers...

REM 檢查 wrangler 是否已安裝
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 錯誤: wrangler 未安裝。請先安裝 wrangler CLI。
    echo npm install -g wrangler
    exit /b 1
)

REM 檢查是否已登入 Cloudflare
wrangler whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 錯誤: 尚未登入 Cloudflare。請先登入。
    echo wrangler login
    exit /b 1
)

echo 📦 安裝依賴...
npm install
if %errorlevel% neq 0 (
    echo ❌ 依賴安裝失敗
    exit /b 1
)

echo 🔨 編譯 TypeScript...
npx tsc
if %errorlevel% neq 0 (
    echo ❌ TypeScript 編譯失敗
    exit /b 1
)

echo 🗄️ 創建 D1 資料庫...
wrangler d1 create gomoku-db 2>temp_output.txt
if %errorlevel% equ 0 (
    echo ✅ D1 資料庫創建成功
) else (
    findstr /c:"already exists" temp_output.txt >nul
    if %errorlevel% equ 0 (
        echo ✅ D1 資料庫已存在
    ) else (
        echo ❌ D1 資料庫創建失敗
        type temp_output.txt
        del temp_output.txt
        exit /b 1
    )
)
del temp_output.txt

echo 🔄 執行資料庫遷移...
wrangler d1 migrations apply gomoku-db --remote
if %errorlevel% neq 0 (
    echo ⚠️ 資料庫遷移可能失敗，請檢查
)

echo 📊 創建 Vectorize 索引...
wrangler vectorize create gomoku-games --dimensions=384 --metric=cosine 2>temp_output.txt
if %errorlevel% equ 0 (
    echo ✅ Vectorize 索引創建成功
) else (
    findstr /c:"already exists" temp_output.txt >nul
    if %errorlevel% equ 0 (
        echo ✅ Vectorize 索引已存在
    ) else (
        echo ⚠️ Vectorize 索引創建可能失敗，請手動檢查
        type temp_output.txt
    )
)
del temp_output.txt

echo 🚀 部署到 Cloudflare Workers...
wrangler deploy
if %errorlevel% neq 0 (
    echo ❌ 部署失敗
    exit /b 1
)

echo.
echo 🎉 部署完成！
echo.
echo 📋 下一步：
echo 1. 檢查 Cloudflare Dashboard 確認所有服務正常運行
echo 2. 測試 Workers AI 功能是否正常
echo 3. 驗證 D1 資料庫連接
echo 4. 確認 Vectorize 索引運作正常
echo.
echo 🔗 相關連結：
echo • Workers Dashboard: https://dash.cloudflare.com/workers
echo • D1 Dashboard: https://dash.cloudflare.com/d1
echo • Vectorize Dashboard: https://dash.cloudflare.com/vectorize
echo.
echo 🎮 現在可以開始使用 OmniAI 五子棋遊戲了！

pause
