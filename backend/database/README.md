# 数据库集成说明

## 安装和配置 PostgreSQL

### 1. 安装 PostgreSQL

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
下载并安装 PostgreSQL: https://www.postgresql.org/download/windows/

### 2. 创建数据库

```bash
# 登录 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE chatbot_db;

# 退出
\q
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并修改数据库配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置正确的数据库连接信息。

### 4. 初始化数据库

运行初始化脚本创建表和初始数据：

```bash
cd backend
npm run init-db
```

这将：
- 创建 `users` 表（用户表）
- 创建 `messages` 表（消息历史表）
- 插入示例用户：`testuser` / `password123`

## 数据库表结构

### users 表
- `id`: SERIAL PRIMARY KEY
- `username`: VARCHAR(50) UNIQUE NOT NULL
- `password_hash`: VARCHAR(255) NOT NULL
- `email`: VARCHAR(100)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### messages 表
- `id`: SERIAL PRIMARY KEY
- `user_id`: INTEGER REFERENCES users(id)
- `message_type`: VARCHAR(20) ('user', 'ai', 'system')
- `content`: TEXT
- `thinking_process`: TEXT (AI 思考过程)
- `client_id`: BIGINT (SSE 客户端ID)
- `timestamp`: TIMESTAMP

## API 端点

### 注册新用户
```
POST /auth/register
Body: {
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com" // 可选
}
```

### 登录
```
POST /auth/login
Body: {
  "username": "testuser",
  "password": "password123"
}
Response: {
  "token": "jwt_token_string",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

## 功能特性

1. **用户注册和登录**：支持新用户注册、密码哈希存储
2. **JWT 认证**：Token 包含用户ID和用户名
3. **消息历史存储**：用户和AI的消息自动保存到数据库
4. **数据库连接池**：使用 pg Pool 管理连接，提升性能

## 注意事项

- 生产环境请使用强密码和安全的 JWT_SECRET
- 建议定期备份数据库
- 考虑添加数据库迁移工具（如 knex.js 或 sequelize）

