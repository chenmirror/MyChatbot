# Chatbot SSE

一个基于 Server-Sent Events (SSE) 的实时聊天机器人应用，集成了豆包大模型，支持用户认证、实时流式对话和AI深度思考过程展示。

## ✨ 功能特性

- 🔐 **用户认证系统**：支持用户注册、登录，使用 JWT Token 进行身份验证
- 💬 **实时聊天**：基于 Server-Sent Events (SSE) 实现实时流式对话
- 🤖 **AI 深度思考**：展示 AI 模型的思考过程，支持展开/收起查看
- 📝 **消息历史**：自动保存用户和 AI 的对话记录到 PostgreSQL 数据库
- 🔄 **自动重连**：SSE 连接断开时自动重连，支持指数退避策略
- 💾 **数据持久化**：使用 PostgreSQL 存储用户信息和聊天历史

## 🛠️ 技术栈

### 后端

- **Koa.js** - 轻量级 Node.js Web 框架
- **PostgreSQL** - 关系型数据库
- **JWT** - JSON Web Token 身份认证
- **bcryptjs** - 密码加密
- **Server-Sent Events (SSE)** - 服务器推送技术

### 前端

- **React** - UI 框架
- **CSS3** - 样式设计

### AI 模型

- **豆包 (Doubao)** - 字节跳动大语言模型 API

## 📁 项目结构

```text
MyChatbot/
├── backend/                 # 后端服务
│   ├── database/           # 数据库相关
│   │   ├── db.mjs         # 数据库连接和查询封装
│   │   ├── init-db.mjs    # 数据库初始化脚本
│   │   └── init.sql       # SQL 初始化脚本
│   ├── server.mjs         # Koa 服务器主文件
│   ├── package.json       # 后端依赖配置
│   └── DATABASE_SETUP.md  # 数据库设置文档
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── App.jsx        # 主应用组件
│   │   ├── components/
│   │   │   └── ChatWindow.jsx  # 聊天窗口组件
│   │   └── index.js       # 入口文件
│   └── package.json       # 前端依赖配置
└── README.md              # 项目说明文档
```

## 🚀 快速开始

### 前置要求

- Node.js (v14 或更高版本)
- PostgreSQL (v12 或更高版本)
- npm 或 yarn

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd MyChatbot
```

### 2. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 3. 配置数据库

#### 安装 PostgreSQL

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

下载并安装: [PostgreSQL Windows 版本](https://www.postgresql.org/download/windows/)

#### 创建数据库

```bash
# 登录 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE chatbot_db;

# 退出
\q
```

#### 初始化数据库

```bash
cd backend
npm run init-db
```

这将创建必要的表结构并插入示例用户（用户名: `testuser`, 密码: `password123`）

### 4. 配置环境变量

项目提供了 `.sample.env` 文件作为环境变量配置模板。请按照以下步骤配置：

```bash
cd backend
# 复制示例文件为 .env
cp .sample.env .env
```

然后编辑 `.env` 文件，将配置项替换为你的实际值：

```env
# 服务器配置
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatbot_db
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT 配置
JWT_SECRET=your_jwt_secret_key_here
TOKEN_EXPIRATION=1h

# 豆包 API 配置
DOUBAO_API_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
DOUBAO_API_KEY=your_doubao_api_key_here
DOUBAO_MODEL=Doubao-lite-llm

# API Key（可选，用于其他认证场景）
API_KEY=your_secret_api_key
```

> **注意**：`.env` 文件不会被提交到 Git 仓库，请确保不要泄露你的敏感信息。

### 5. 启动服务

#### 启动后端服务

```bash
cd backend
npm start
# 或开发模式（自动重启）
npm run dev
```

后端服务将在 `http://localhost:3000` 启动

#### 启动前端服务

```bash
cd frontend
npm start
```

前端应用将在 `http://localhost:3000` 启动（如果端口冲突会自动使用其他端口，如 3001）

## 📖 使用说明

1. **注册/登录**：首次使用需要注册账号，或使用示例账号登录（testuser / password123）
2. **开始聊天**：登录成功后，在输入框中输入消息并发送
3. **查看思考过程**：AI 回答时会显示思考过程，可以点击展开/收起查看详细内容
4. **实时响应**：AI 的回答会以流式方式实时显示，无需等待完整响应

## 🔌 API 文档

### 认证相关

#### 用户注册

```text
POST /auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com"  // 可选
}
```

#### 用户登录

```text
POST /auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}

Response:
{
  "token": "jwt_token_string",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

### 聊天相关

#### 建立 SSE 连接

```text
GET /chat/stream?token=<jwt_token>
```

#### 发送消息

```text
POST /chat/message
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "message": "你好",
  "clientId": 1234567890
}
```

## 🔧 开发说明

### 后端开发

```bash
cd backend
npm run dev  # 使用 nodemon 自动重启
```

### 前端开发

```bash
cd frontend
npm start  # 启动开发服务器，支持热重载
```

### 数据库操作

```bash
# 重新初始化数据库（会清空现有数据）
cd backend
npm run init-db
```

## 📝 环境变量说明

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `DB_HOST` | PostgreSQL 主机地址 | `localhost` | 否 |
| `DB_PORT` | PostgreSQL 端口 | `5432` | 否 |
| `DB_NAME` | 数据库名称 | `chatbot_db` | 否 |
| `DB_USER` | 数据库用户名 | 系统用户名 | 否 |
| `DB_PASSWORD` | 数据库密码 | - | 否 |
| `JWT_SECRET` | JWT 密钥 | - | **是** |
| `TOKEN_EXPIRATION` | Token 有效期 | `1h` | 否 |
| `DOUBAO_API_URL` | 豆包 API 地址 | - | **是** |
| `DOUBAO_API_KEY` | 豆包 API Key | - | **是** |
| `DOUBAO_MODEL` | 豆包模型名称 | `Doubao-lite-llm` | 否 |
| `PORT` | 服务器端口 | `3000` | 否 |

## ⚠️ 注意事项

1. **安全性**：
   - 生产环境请使用强密码和安全的 `JWT_SECRET`
   - 建议定期更换 API Key
   - 使用 HTTPS 协议

2. **数据库**：
   - 定期备份数据库
   - 生产环境建议使用连接池优化性能

3. **API 限制**：
   - 注意豆包 API 的调用频率限制
   - 建议添加请求限流机制

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 📧 联系方式

如有问题或建议，请通过 Issue 联系。

---

## 🎉 结语

Happy Coding!
