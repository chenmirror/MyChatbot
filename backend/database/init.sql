-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以加快用户名查询
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 消息历史表（可选，用于存储聊天记录）
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL, -- 'user', 'ai', 'system'
    content TEXT NOT NULL,
    thinking_process TEXT, -- AI 的思考过程
    client_id BIGINT, -- SSE 连接的客户端ID
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以加快用户消息查询
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 users 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入示例用户（密码: password123）
-- 注意：这里使用 bcrypt 哈希，实际使用时需要在注册时生成
INSERT INTO users (username, password_hash, email) 
VALUES ('testuser', '$2a$10$45hF3OFtCNQbc3eOvT.zjOh5HLmCegvhYg4NebhmDnSaDA/vY/9mm', 'test@example.com')
ON CONFLICT (username) DO NOTHING;

