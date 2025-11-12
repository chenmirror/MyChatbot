# PostgreSQL 数据库集成指南

## 1. 安装 PostgreSQL

### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows
下载并安装: https://www.postgresql.org/download/windows/

## 2. 创建数据库

```bash
# 登录 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE chatbot_db;

# 退出
\q
```

## 3. 配置环境变量

在 `backend/.env` 文件中添加以下配置：

```env
# PostgreSQL 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatbot_db
DB_USER=postgres
DB_PASSWORD=your_password_here
```

## 4. 初始化数据库

```bash
cd backend
npm run init-db
```

这将创建表结构并插入示例用户（testuser / password123）

## 5. 启动服务器

```bash
npm start
# 或开发模式
npm run dev
```

## API 端点

### 注册新用户
```
POST /auth/register
Body: {
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com"  // 可选
}
```

### 登录
```
POST /auth/login
Body: {
  "username": "testuser",
  "password": "password123"
}
```
