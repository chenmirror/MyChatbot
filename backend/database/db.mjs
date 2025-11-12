// database/db.mjs
import pg from 'pg';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const { Pool } = pg;

// 计算默认数据库用户：优先 DB_USER/PGUSER，其次系统用户名
const DEFAULT_DB_USER = process.env.DB_USER || process.env.PGUSER || os.userInfo().username;

// 创建数据库连接池（注意：默认不强制密码，使用本地信任或 .env 配置）
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'chatbot_db',
  user: DEFAULT_DB_USER,
  password: process.env.DB_PASSWORD || undefined,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log(`📦 PostgreSQL 连接参数:`, {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'chatbot_db',
  user: DEFAULT_DB_USER,
  password: process.env.DB_PASSWORD ? '******' : '(未设置)'
});

// 测试数据库连接
pool.on('connect', () => {
  console.log('✅ PostgreSQL 数据库连接成功');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 数据库连接错误:', err);
});

// 封装数据库查询方法
export const db = {
  // 执行查询
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('执行查询:', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw error;
    }
  },

  // 根据用户名查找用户
  async findUserByUsername(username) {
    const result = await this.query(
      'SELECT id, username, password_hash, email, created_at FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  },

  // 根据 ID 查找用户
  async findUserById(userId) {
    const result = await this.query(
      'SELECT id, username, password_hash, email, created_at FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  },

  // 创建新用户
  async createUser(username, passwordHash, email = null) {
    const result = await this.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, passwordHash, email]
    );
    return result.rows[0];
  },

  // 保存消息到数据库（可选功能）
  async saveMessage(userId, messageType, content, thinkingProcess = null, clientId = null) {
    const result = await this.query(
      'INSERT INTO messages (user_id, message_type, content, thinking_process, client_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, timestamp',
      [userId, messageType, content, thinkingProcess, clientId]
    );
    return result.rows[0];
  },

  // 获取用户的聊天历史（可选功能）
  async getUserMessages(userId, limit = 50, offset = 0) {
    const result = await this.query(
      'SELECT id, message_type, content, thinking_process, timestamp FROM messages WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  },

  // 关闭连接池
  async close() {
    await pool.end();
  },
};

export default db;

