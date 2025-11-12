#!/usr/bin/env node
// database/init-db.mjs
// 数据库初始化脚本

import pg from 'pg';
import os from 'os';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_DB_USER = process.env.DB_USER || process.env.PGUSER || os.userInfo().username;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'chatbot_db',
  user: DEFAULT_DB_USER,
  password: process.env.DB_PASSWORD || undefined,
});

console.log('📦 PostgreSQL 初始化参数: ', {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'chatbot_db',
  user: DEFAULT_DB_USER,
  password: process.env.DB_PASSWORD ? '******' : '(未设置)'
});

async function initDatabase() {
  try {
    console.log('🔌 正在连接数据库...');
    
    // 读取 SQL 文件
    const sqlFile = join(__dirname, 'init.sql');
    const sql = readFileSync(sqlFile, 'utf-8');

    // 执行 SQL
    await pool.query(sql);
    
    console.log('✅ 数据库初始化成功！');
    console.log('📝 已创建以下表:');
    console.log('   - users (用户表)');
    console.log('   - messages (消息历史表)');
    console.log('📝 已插入示例用户: testuser / password123');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

