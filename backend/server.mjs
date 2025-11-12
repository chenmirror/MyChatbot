// backend/server.js
import Koa from 'koa';
import Router from 'koa-router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './database/db.mjs';
// import fetch from 'node-fetch'; // 移除node-fetch依赖

dotenv.config();

const REQUIRED_API_KEY = process.env.API_KEY; // 从 .env 文件获取API Key
const JWT_SECRET = process.env.JWT_SECRET; // JWT 密钥
const TOKEN_EXPIRATION = process.env.TOKEN_EXPIRATION || '1h'; // JWT 有效期，默认为1小时

// 鉴权中间件
async function authenticate(ctx, next) {
  let token = null;
  const authHeader = ctx.headers['authorization'];
  const queryToken = ctx.query.token; // 从URL查询参数获取token

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    ctx.status = 401; // Unauthorized
    ctx.body = { error: '未经授权的访问: 需要提供 Token' };
    console.warn('未经授权的访问尝试：缺少 Token');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // 验证用户是否仍然存在于数据库中（可选，提升安全性）
    const user = await db.findUserById(decoded.userId);
    if (!user) {
      ctx.status = 401; // Unauthorized
      ctx.body = { error: '用户不存在或已被删除' };
      console.warn(`Token中的用户ID不存在: ${decoded.userId}`);
      return;
    }
    ctx.state.user = decoded; // 将解码后的用户信息存储在 ctx.state.user 中
    await next();
  } catch (err) {
    ctx.status = 401; // Unauthorized
    ctx.body = { error: '无效或过期的 Token' };
    console.warn(`无效或过期的 Token: ${err.message}`);
    return;
  }
}

// 豆包大模型配置 (请在这里补充您的信息)
const DOUBAO_API_URL = process.env.DOUBAO_API_URL || 'YOUR_DOUBAO_API_URL'; // 例如: https://ark.cn-beijing.volces.com/api/v3/chat/completions
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || 'YOUR_DOUBAO_API_KEY';
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'Doubao-lite-llm'; // 替换为您的豆包模型名称

const app = new Koa();
const router = new Router();

// 中间件 - 最简单的CORS配置
// app.use(cors());
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));
app.use(bodyParser());

// 存储SSE连接的数组
const clients = [];

// 根路径路由
router.get('/', async (ctx) => {
  ctx.body = {
    message: 'SSE聊天机器人后端服务运行中',
    status: 'active'
  };
});

// 用户注册路由
router.post('/auth/register', async (ctx) => {
  const { username, password, email } = ctx.request.body;

  if (!username || !password) {
    ctx.status = 400; // Bad Request
    ctx.body = { error: '用户名和密码不能为空' };
    return;
  }

  // 验证用户名长度
  if (username.length < 3 || username.length > 50) {
    ctx.status = 400;
    ctx.body = { error: '用户名长度必须在3-50个字符之间' };
    return;
  }

  // 验证密码长度
  if (password.length < 6) {
    ctx.status = 400;
    ctx.body = { error: '密码长度至少为6个字符' };
    return;
  }

  try {
    // 检查用户名是否已存在
    const existingUser = await db.findUserByUsername(username);
    if (existingUser) {
      ctx.status = 409; // Conflict
      ctx.body = { error: '用户名已存在' };
      return;
    }

    // 生成密码哈希
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 创建新用户
    const newUser = await db.createUser(username, passwordHash, email || null);

    ctx.status = 201; // Created
    ctx.body = {
      message: '用户注册成功',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    };
    console.log(`新用户注册成功: ${username} (ID: ${newUser.id})`);
  } catch (error) {
    console.error('注册失败:', error);
    ctx.status = 500;
    ctx.body = { error: '注册失败，请稍后重试' };
  }
});

// 登录路由
router.post('/auth/login', async (ctx) => {
  const { username, password } = ctx.request.body;

  if (!username || !password) {
    ctx.status = 400; // Bad Request
    ctx.body = { error: '用户名和密码不能为空' };
    console.warn('登录失败: 用户名或密码为空');
    return;
  }

  try {
    // 从数据库查找用户
    const user = await db.findUserByUsername(username);
    if (!user) {
      ctx.status = 401; // Unauthorized
      ctx.body = { error: '用户名或密码不正确' };
      console.warn(`登录失败: 用户不存在. 用户名: ${username}`);
      return;
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      ctx.status = 401; // Unauthorized
      ctx.body = { error: '用户名或密码不正确' };
      console.warn(`登录失败: 密码不匹配. 用户名: ${username}`);
      return;
    }

    // 签发JWT，包含用户ID和用户名
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRATION }
    );

    ctx.body = { 
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    };
    console.log(`用户登录成功: ${username} (ID: ${user.id})`);
  } catch (error) {
    console.error('登录失败:', error);
    ctx.status = 500;
    ctx.body = { error: '登录失败，请稍后重试' };
  }
});

// SSE连接路由
router.get('/chat/stream', authenticate, async (ctx) => {
  console.log('收到SSE连接请求');
  
  ctx.request.socket.setTimeout(0); // 禁用超时
  ctx.request.socket.setNoDelay(true);
  ctx.request.socket.setKeepAlive(true);

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // 阻止Koa自动关闭响应，保持SSE连接
  ctx.respond = false; 

  ctx.status = 200;

  const clientId = Date.now();
  
  // 立即发送连接成功消息
  const connectedMessage = `data: ${JSON.stringify({ 
    type: 'connected', 
    message: '连接成功',
    clientId: clientId 
  })}\n\n`;
  ctx.res.write(connectedMessage);
  console.log(`向客户端 ${clientId} 发送: ${connectedMessage.trim()}`);

  // 存储客户端连接
  const client = {
    id: clientId,
    ctx: ctx,
    heartbeatInterval: null // 添加一个属性来存储心跳定时器
  };
  clients.push(client);
  
  console.log(`客户端 ${clientId} 已连接，当前连接数: ${clients.length}`);

  // 添加心跳检测：每20秒发送一个空消息
  client.heartbeatInterval = setInterval(() => {
    try {
      ctx.res.write(':\n\n'); // 发送一个空消息，保持连接活跃
      console.log(`客户端 ${clientId} 发送心跳`);
    } catch (error) {
      console.error(`向客户端 ${clientId} 发送心跳失败:`, error);
      // 如果发送心跳失败，说明连接可能已经断开，可以清理
      clearInterval(client.heartbeatInterval);
      const index = clients.findIndex(c => c.id === clientId);
      if (index !== -1) {
        clients.splice(index, 1);
        console.log(`客户端 ${clientId} 已断开（心跳失败），剩余连接数: ${clients.length}`);
      }
    }
  }, 20000); // 每20秒发送一次

  // 处理连接关闭
  ctx.req.on('close', () => {
    clearInterval(client.heartbeatInterval); // 清除心跳定时器
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      clients.splice(index, 1);
      console.log(`客户端 ${clientId} 已断开，剩余连接数: ${clients.length}`);
    }
  });
});

// 发送消息路由
router.post('/chat/message', authenticate, async (ctx) => {
  const { message, clientId } = ctx.request.body; // 从请求体中解构出 clientId
  
  if (!message || !clientId) {
    ctx.status = 400;
    ctx.body = { error: '消息或客户端ID不能为空' };
    return;
  }
  
  const userId = ctx.state.user.userId; // 从JWT中获取用户ID
  console.log(`收到用户 ${userId} (客户端 ${clientId}) 的消息: ${message}`);
  
  try {
    // 将用户消息保存到数据库（可选，用于历史记录）
    await db.saveMessage(userId, 'user', message, null, clientId);
  } catch (error) {
    console.error('保存用户消息到数据库失败:', error);
    // 不影响正常流程，继续执行
  }
  
  // 将用户消息回显给发送者
  sendToClient(clientId, {
    type: 'user_message',
    content: message,
    timestamp: new Date().toISOString()
  });

  // 模拟AI响应，并将客户端ID和用户ID传递给它
  simulateAIResponse(message, clientId, userId); 
  
  ctx.body = { success: true };
});

// 模拟AI响应函数
function simulateAIResponse(userMessage, targetClientId, userId) {

  // 发送AI思考状态给特定客户端
  sendToClient(targetClientId, {
    type: 'ai_thinking',
    content: true,
    timestamp: new Date().toISOString()
  });

  // 移除 system prompt，让模型输出其最原始的“深度思考”内容
  const messages = [
    { role: "user", content: userMessage }
  ];

  fetch(DOUBAO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DOUBAO_API_KEY}`,
      'Accept': 'text/event-stream', // 期望SSE响应
    },
    body: JSON.stringify({
      model: DOUBAO_MODEL,
      messages: messages,
      stream: true // 启用流式传输
    }),
  })
  .then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`豆包API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // 调试信息：打印响应头和内容类型
    console.log(`豆包API响应状态: ${response.status}`);
    console.log(`豆包API响应头 Content-Type: ${response.headers.get('Content-Type')}`);
    console.log(`typeof response.body: ${typeof response.body}`);
    if (typeof ReadableStream !== 'undefined') {
      console.log(`response.body instanceof ReadableStream: ${response.body instanceof ReadableStream}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let aiFullResponse = '';
    let hasSentThinkingProcessStart = false;
    let hasSentThinkingProcessEnd = false;
    let hasSentActualAnswer = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // 豆包API的SSE格式可能需要解析，例如处理 'data: ' 前缀和空行
      chunk.split('\n\n').forEach(eventChunk => {
        if (eventChunk.startsWith('data: ')) {
          const dataString = eventChunk.substring(6).trim();
          if (dataString === '[DONE]') {
            return; // 流结束
          }
          try {
            const parsedData = JSON.parse(dataString);
            // console.log(parsedData,'parsedData');
            const reasoningContent = parsedData.choices[0]?.delta?.reasoning_content || '';
            const actualContent = parsedData.choices[0]?.delta?.content || '';

            // 处理深度思考过程
            if (reasoningContent) {
              if (!hasSentThinkingProcessStart) {
                sendToClient(targetClientId, { type: 'ai_thinking_process_start', timestamp: new Date().toISOString() });
                hasSentThinkingProcessStart = true;
              }
              sendToClient(targetClientId, {
                type: 'ai_thinking_process_chunk',
                content: reasoningContent,
                timestamp: new Date().toISOString()
              });
            }

            // 处理真正回答内容
            if (actualContent) {
              if (hasSentThinkingProcessStart && !hasSentThinkingProcessEnd) {
                sendToClient(targetClientId, { type: 'ai_thinking_process_end', timestamp: new Date().toISOString() });
                hasSentThinkingProcessEnd = true;
              }
              sendToClient(targetClientId, {
                type: 'ai_message_chunk',
                content: actualContent,
                timestamp: new Date().toISOString()
              });
              hasSentActualAnswer = true;
            }

            // 如果同时存在 reasoningContent 和 actualContent，aiFullResponse 累加 actualContent
            // 如果只有 reasoningContent，aiFullResponse 不累加它，因为这部分前端会单独展示
            if (actualContent) {
              aiFullResponse += actualContent; // aiFullResponse 仅累加最终答案部分
            }

          } catch (jsonError) {
            console.error('解析豆包API SSE数据失败:', jsonError, '原始数据:', dataString);
          }
        }
      });
    }
    
    // 确保在流结束后，如果思考过程开始了但没有明确结束，则发送结束事件
    if (hasSentThinkingProcessStart && !hasSentThinkingProcessEnd) {
      sendToClient(targetClientId, { type: 'ai_thinking_process_end', timestamp: new Date().toISOString() });
    }

    // 发送AI完成思考状态给特定客户端
    sendToClient(targetClientId, {
      type: 'ai_thinking',
      content: false,
      timestamp: new Date().toISOString()
    });

    // 将AI回答保存到数据库（可选，用于历史记录）
    if (userId && aiFullResponse) {
      db.saveMessage(userId, 'ai', aiFullResponse, null, targetClientId).catch(error => {
        console.error('保存AI消息到数据库失败:', error);
      });
    }
  })
  .catch(error => {
    console.error('调用豆包API时出错:', error);
    sendToClient(targetClientId, {
      type: 'system',
      content: `AI服务出错: ${error.message || error.toString()}`,
      timestamp: new Date().toISOString()
    });
    sendToClient(targetClientId, {
      type: 'ai_thinking',
      content: false,
      timestamp: new Date().toISOString()
    });
  });
}

// 广播消息给所有客户端
// function broadcast(data) {
//   clients.forEach(client => {
//     try {
//       client.ctx.res.write(`data: ${JSON.stringify(data)}\n\n`);
//     } catch (error) {
//       console.error(`向客户端发送消息失败:`, error);
//     }
//   });
// }

// 新增：发送消息给特定客户端的函数
function sendToClient(targetClientId, data) {
  const client = clients.find(c => c.id === targetClientId);
  if (client) {
    try {
      client.ctx.res.write(`data: ${JSON.stringify(data)}\n\n`);
      // console.log(`向客户端 ${targetClientId} 发送特定消息: ${JSON.stringify(data)}`);
    } catch (error) {
       console.error(`向客户端 ${targetClientId} 发送特定消息失败:`, error);
    }
  } else {
    console.warn(`未找到客户端 ${targetClientId}，无法发送特定消息。`);
  }
}

// 设置路由
app.use(router.routes()).use(router.allowedMethods());

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SSE聊天服务器运行在 http://localhost:${PORT}`);
});