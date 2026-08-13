-- 棋型書：以局部棋型為索引鍵，記錄勝方在該棋型下的後續手
--
-- 取代原本以文字 embedding 做相似度檢索的做法（實測完全無法分辨盤面：
-- 幾乎相同與完全不同的盤面餘弦相似度分別為 0.9921 與 0.9728~0.9892）。
CREATE TABLE IF NOT EXISTS move_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_key TEXT NOT NULL,   -- 正規化後的局部棋型（顏色無關、已做八向對稱正規化）
    next_dr INTEGER NOT NULL,    -- 後續手相對視窗中心的位移（正規空間）
    next_dc INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 查詢一律是 pattern_key 的等值比對後分組計數
CREATE INDEX IF NOT EXISTS idx_move_patterns_key
    ON move_patterns(pattern_key);

-- 供日後依對局清理或去重
CREATE INDEX IF NOT EXISTS idx_move_patterns_game
    ON move_patterns(game_id);
