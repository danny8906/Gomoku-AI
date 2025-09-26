-- 建立用戶表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 1200,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 建立遊戲記錄表
CREATE TABLE game_records (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    opponent_id TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('pvp', 'ai')),
    result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
    moves TEXT NOT NULL, -- JSON 格式儲存走法
    duration INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    rating_change INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (opponent_id) REFERENCES users(id)
);

-- 建立遊戲狀態表（用於持久化遊戲）
CREATE TABLE games (
    id TEXT PRIMARY KEY,
    board_state TEXT NOT NULL, -- JSON 格式儲存棋盤狀態
    current_player TEXT CHECK (current_player IN ('black', 'white')),
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
    mode TEXT NOT NULL CHECK (mode IN ('pvp', 'ai')),
    winner TEXT CHECK (winner IN ('black', 'white', 'draw')),
    room_code TEXT,
    black_player_id TEXT,
    white_player_id TEXT,
    moves TEXT DEFAULT '[]', -- JSON 格式儲存走法
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (black_player_id) REFERENCES users(id),
    FOREIGN KEY (white_player_id) REFERENCES users(id)
);

-- 建立房間表
CREATE TABLE rooms (
    code TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- 建立索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_rating ON users(rating DESC);
CREATE INDEX idx_game_records_user_id ON game_records(user_id);
CREATE INDEX idx_game_records_created_at ON game_records(created_at DESC);
CREATE INDEX idx_games_room_code ON games(room_code);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_rooms_status ON rooms(status);
