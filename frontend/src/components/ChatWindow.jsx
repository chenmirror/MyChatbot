// frontend/src/components/ChatWindow.jsx
import React, { useState, useEffect, useRef } from 'react';
import './ChatWindow.css';


// 辅助函数：生成一个更健壮的唯一ID
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2)}`; // 确保随机部分足够长

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false); // 保持此状态用于控制全局loading，但UI渲染逻辑会调整
  const messagesEndRef = useRef(null);
  const clientIdRef = useRef(null); // 新增：用于存储客户端ID
  const currentAiMessageIdRef = useRef(null); // 新增：用于跟踪当前AI消息的ID
  const suppressAutoScrollRef = useRef(false); // 控制是否临时抑制全局滚动到页面底部
  const scrollThinkingIntoView = (messageId) => {
    const el = document.getElementById(`thinking-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  
  // 新增：鉴权相关状态
  const [token, setToken] = useState(localStorage.getItem('jwtToken'));
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 移除：深度思考过程相关状态，改为集成到messages中
  // const [thinkingProcessContent, setThinkingProcessContent] = useState('');
  // const [showThinkingProcess, setShowThinkingProcess] = useState(false);

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // 仅当新消息到来且需要滚动到底部时才调用 scrollToBottom
    // 避免在展开/收起思考过程时触发滚动
    if (suppressAutoScrollRef.current) {
      suppressAutoScrollRef.current = false;
      return;
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && (lastMessage.type !== 'ai' || lastMessage.showActualAnswer)) {
      scrollToBottom();
    }
  }, [messages]);

  // 建立SSE连接
  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;
    let reconnectInterval = 1000; // 初始重连间隔1秒

    const connectSSE = () => {
      if (!token) {
        console.log('未检测到 Token，跳过SSE连接尝试。');
        setIsConnected(false);
        setMessages([]); // 新增：如果无token，清空消息列表，确保不保留历史信息
        return;
      }
      console.log('尝试建立SSE连接...');
      setIsConnected(false); // 在尝试连接时设置为未连接状态
      
      const sseUrl = `http://localhost:3000/chat/stream${token ? `?token=${token}` : ''}`; // 将token作为查询参数
      eventSource = new EventSource(sseUrl);
      
      eventSource.onopen = () => {
        console.log('SSE连接已建立');
        setIsConnected(true);
        clearTimeout(reconnectTimeout); // 连接成功，清除重连定时器
        reconnectInterval = 1000; // 重置重连间隔
      };
      
      eventSource.onmessage = (event) => {
        try {
          // 忽略后端发送的心跳消息
          if (event.data === ':') {
            console.log('收到SSE心跳消息');
            return;
          }
          console.log('Received raw SSE event:', event.data);
          const data = JSON.parse(event.data);
          console.log('Parsed SSE data:', data);

          if (data.type === 'connected' && data.clientId) {
            clientIdRef.current = data.clientId;
            console.log('客户端ID已保存:', data.clientId);
          }
          
          handleServerEvent(data);
        } catch (error) {
          console.error('解析SSE消息失败:', error);
          // 鉴权失败时，服务器可能发送一个非JSON的错误响应
          // JWT鉴权失败通常是401，我们将在onerror中统一处理，这里移除旧的API Key检查。
          setMessages(prev => [...prev, {
            id: generateUniqueId(),
            type: 'system',
            content: 'SSE消息解析失败。请检查后端服务状态或您的网络连接。',
            timestamp: new Date().toISOString()
          }]);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE连接错误:', error, 'readyState:', eventSource.readyState);
        setIsConnected(false);
        currentAiMessageIdRef.current = null; // 连接错误时重置ref
        eventSource.close(); // 关闭当前连接，准备重连

        // 如果是401错误，可能表示Token无效或过期，不进行重连
        // 修正：EventSource的error对象不直接提供status，通过readyState和isConnected状态推断
        if (eventSource.readyState === EventSource.CLOSED && !isConnected && token) {
          console.warn('SSE连接鉴权失败（可能Token无效或过期），正在清除Token并跳转到登录页。');
          setMessages(prev => [...prev, {
            id: generateUniqueId(),
            type: 'system',
            content: 'SSE连接鉴权失败，请重新登录。' + (error.message ? ` 错误信息: ${error.message}` : ''),
            timestamp: new Date().toISOString()
          }]);
          setToken(null); // 清除无效Token
          localStorage.removeItem('jwtToken');
          return; // 阻止重连
        }

        // 实现指数退避重连
        reconnectTimeout = setTimeout(() => {
          reconnectInterval = Math.min(reconnectInterval * 2, 30000); // 最大重连间隔30秒
          connectSSE(); // 尝试重新连接
        }, reconnectInterval);
      };
    };

    if (token) {
      connectSSE(); // 如果有token，首次建立连接
    } else {
      console.log('无Token，不建立SSE连接。');
      setIsConnected(false);
      setMessages(prev => [...prev, {
        id: generateUniqueId(),
        type: 'system',
        content: '请先登录以建立聊天连接。',
        timestamp: new Date().toISOString()
      }]);
    }

    return () => {
      console.log('清理SSE连接...');
      eventSource?.close();
      clearTimeout(reconnectTimeout);
      currentAiMessageIdRef.current = null;

      // 新增：当token失效或被清除时，也清空消息列表和输入框
      if (!token) { 
        setMessages([]);
        setInputMessage(''); // 清空输入框内容
        console.log('Token失效或被清除，已清空聊天记录和输入框。');
      }
    };
  }, [token]); // 依赖项包含token，以便在token变化时重新连接

  // 处理服务器发送的事件
  const handleServerEvent = (data) => {
    console.log('handleServerEvent received data:', data);
    console.log('Current currentAiMessageIdRef.current before switch:', currentAiMessageIdRef.current);

    switch (data.type) {
      case 'connected':
        setMessages(prev => [...prev, {
          id: generateUniqueId(), // 使用新的唯一ID
          type: 'system',
          content: data.message + ` (ID: ${data.clientId})`, // 可选：显示客户端ID
          timestamp: new Date().toISOString()
        }]);
        break;
        
      case 'user_message':
        setMessages(prev => [...prev, {
          id: generateUniqueId(), // 使用新的唯一ID
          type: 'user',
          content: data.content,
          timestamp: data.timestamp
        }]);
        break;
        
      case 'ai_thinking':
        // setIsAiThinking(data.content); // 更新全局AI思考状态

        if (data.content === true) { // AI开始思考
          const newAiMessageId = generateUniqueId();
          currentAiMessageIdRef.current = newAiMessageId;
          console.log('AI thinking TRUE, new currentAiMessageIdRef.current:', newAiMessageId);

          setMessages(prev => {
            let updatedMessages = [...prev];
            updatedMessages.push({
              id: newAiMessageId,
              type: 'ai',
              content: '',
              isThinking: true,
              thinkingProcess: '', // 为新的AI消息添加深度思考过程属性
              isThinkingProcessExpanded: false, // 默认收起
              thinkingProcessStatus: 'pending', // 新增：思考过程状态，例如 'pending', 'generating', 'completed'
              showActualAnswer: false, // 新增：默认不显示实际回答气泡
              timestamp: new Date().toISOString()
            });
            console.log('AI thinking TRUE, messages after push:', updatedMessages);
            return updatedMessages;
          });
        } else { // AI思考结束
          setMessages(prev => {
            let updatedMessages = [...prev];
            let aiMessageIndex = updatedMessages.findIndex(msg => msg.id === currentAiMessageIdRef.current);
            console.log('AI thinking FALSE, currentAiMessageIdRef.current:', currentAiMessageIdRef.current, 'aiMessageIndex:', aiMessageIndex);
            if (aiMessageIndex !== -1) {
              updatedMessages[aiMessageIndex] = {
                ...updatedMessages[aiMessageIndex],
                isThinking: false
              };
            }
            console.log('AI thinking FALSE, messages after update:', updatedMessages);
            return updatedMessages;
          });
          // 在这里重置 currentAiMessageIdRef.current，表示此轮AI响应结束。
          currentAiMessageIdRef.current = null; 
          console.log('AI thinking FALSE, currentAiMessageIdRef.current reset to:', currentAiMessageIdRef.current);
        }
        break;

      case 'ai_thinking_process_start':
        suppressAutoScrollRef.current = true; // 避免被全局滚到底部
        setMessages(prev => {
          let updatedMessages = [...prev];
          const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === currentAiMessageIdRef.current);
          if (aiMessageIndex !== -1) {
            updatedMessages[aiMessageIndex] = {
              ...updatedMessages[aiMessageIndex],
              thinkingProcess: '', // 清空之前的思考过程
              isThinkingProcessExpanded: true, // 深度思考开始时默认展开
              thinkingProcessStatus: 'generating', // 更新状态为正在思考
            };
          }
          return updatedMessages;
        });
        // 将思考过程区域滚动到视野内
        setTimeout(() => {
          if (currentAiMessageIdRef.current) {
            scrollThinkingIntoView(currentAiMessageIdRef.current);
          }
        }, 0);
        console.log('AI thinking process started for ID:', currentAiMessageIdRef.current);
        break;
      
      case 'ai_thinking_process_chunk':
        suppressAutoScrollRef.current = true; // 避免全局滚动到底部
        setMessages(prev => {
          let updatedMessages = [...prev];
          const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === currentAiMessageIdRef.current);
          if (aiMessageIndex !== -1) {
            updatedMessages[aiMessageIndex] = {
              ...updatedMessages[aiMessageIndex],
              thinkingProcess: updatedMessages[aiMessageIndex].thinkingProcess + data.content,
              // 第一次收到思考过程chunk时可以自动展开，也可以保持默认收起让用户手动展开
              // isThinkingProcessExpanded: true, // 首次接收chunk时自动展开
            };
          }
          return updatedMessages;
        });
        // 保持思考过程区域处于可视区域附近
        setTimeout(() => {
          if (currentAiMessageIdRef.current) {
            scrollThinkingIntoView(currentAiMessageIdRef.current);
          }
        }, 0);
        console.log('AI thinking process chunk for ID:', currentAiMessageIdRef.current, 'chunk:', data.content);
        break;

      case 'ai_thinking_process_end':
        suppressAutoScrollRef.current = true; // 结束时也不滚到底部
        setMessages(prev => {
          let updatedMessages = [...prev];
          const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === currentAiMessageIdRef.current);
          if (aiMessageIndex !== -1) {
            updatedMessages[aiMessageIndex] = {
              ...updatedMessages[aiMessageIndex],
              isThinkingProcessExpanded: false, // 深度思考结束时自动收起
              thinkingProcessStatus: 'completed', // 更新状态为已完成
              showActualAnswer: true, // 深度思考结束时显示实际回答气泡
            };
          }
          return updatedMessages;
        });
        console.log('AI thinking process ended for ID:', currentAiMessageIdRef.current);
        break;
        
      case 'ai_message_chunk':
        // 确保在接收到实际消息块时，如果思考过程还未结束，则先结束它（在后端逻辑中处理了）
        // 这里只是强制确保isThinkingProcessExpanded不会因为ai_message_chunk而自动展开
        setMessages(prev => {
          let updatedMessages = [...prev];
          let aiMessageIndex = -1;

          // 优先通过 currentAiMessageIdRef 查找正在进行的AI消息
          if (currentAiMessageIdRef.current) {
            aiMessageIndex = updatedMessages.findIndex(msg => msg.id === currentAiMessageIdRef.current);
          }
          console.log('AI message chunk, currentAiMessageIdRef.current:', currentAiMessageIdRef.current, 'initial aiMessageIndex:', aiMessageIndex);

          // 如果没有找到正在进行的AI消息（或者 currentAiMessageIdRef.current 为 null），
          // 尝试查找最近的、类型为AI的消息进行追加。这能应对 ai_thinking 事件延迟或被忽略的情况。
          if (aiMessageIndex === -1) {
            for (let i = updatedMessages.length - 1; i >= 0; i--) {
              if (updatedMessages[i].type === 'ai') {
                aiMessageIndex = i;
                currentAiMessageIdRef.current = updatedMessages[i].id; // 更新ref指向这个消息
                console.log('AI message chunk: Found last AI message to append to. ID:', updatedMessages[i].id);
                break;
              }
            }
          }

          // 如果最终还是没有找到可以追加的消息，则创建一个新的AI消息
          if (aiMessageIndex === -1) {
            console.warn("AI message chunk: No ongoing AI message found and no suitable last AI message. Creating a new one.");
            const newAiMessageId = generateUniqueId();
            updatedMessages.push({
              id: newAiMessageId,
              type: 'ai',
              content: data.content, // 新消息直接包含当前chunk的内容
              isThinking: false, // 默认不是思考中
              thinkingProcess: '', // 新消息的深度思考过程为空
              isThinkingProcessExpanded: false, // 新消息默认收起
              thinkingProcessStatus: 'pending', // 确保新消息的思考状态初始化
              showActualAnswer: false, // 回退创建时也默认不显示实际回答气泡
              timestamp: new Date().toISOString()
            });
            currentAiMessageIdRef.current = newAiMessageId; // 更新ref指向这个新消息
            aiMessageIndex = updatedMessages.length - 1; // 设置为新消息的索引
            console.log('AI message chunk: New message created. ID:', currentAiMessageIdRef.current);
          } else {
            // 找到了可以追加的消息，追加内容
            updatedMessages[aiMessageIndex] = {
              ...updatedMessages[aiMessageIndex],
              content: updatedMessages[aiMessageIndex].content + data.content,
              isThinking: false // 确保在接收到内容时不是思考状态
            };
            console.log('AI message chunk: Content appended to existing message. ID:', updatedMessages[aiMessageIndex].id);
          }
          console.log('AI message chunk, messages after update:', updatedMessages);
          return updatedMessages;
        });
        break;
        
      default:
        console.log('未知事件类型:', data.type);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    // 检查客户端ID是否设置
    if (!clientIdRef.current) {
      console.error('客户端ID未设置，无法发送消息。');
      return;
    }

    if (!token) {
      console.error('未检测到 Token，无法发送消息。');
      setMessages(prev => [...prev, {
        id: generateUniqueId(),
        type: 'system',
        content: '未登录，无法发送消息。请先登录。',
        timestamp: new Date().toISOString()
      }]);
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // 添加JWT Token请求头
        },
        body: JSON.stringify({
          message: inputMessage,
          clientId: clientIdRef.current // 发送客户端ID
        }),
      });
      
      if (response.ok) {
        setInputMessage('');
        // 注意：用户消息现在会通过SSE回显，所以这里不需要再添加到messages状态
      } else if (response.status === 401) {
        console.error('消息发送失败: 鉴权失败。');
        setMessages(prev => [...prev, {
          id: generateUniqueId(),
          type: 'system',
          content: '消息发送失败：Token无效或已过期。请重新登录。',
          timestamp: new Date().toISOString()
        }]);
        setToken(null); // 清除无效Token
        localStorage.removeItem('jwtToken');
      } else {
        console.error(`消息发送失败: ${response.status} ${response.statusText}`);
        setMessages(prev => [...prev, {
          id: generateUniqueId(),
          type: 'system',
          content: `消息发送失败：${response.statusText || '未知错误'}。`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('发送消息时出错:', error);
    }
  };

  // 处理回车键发送
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 处理登录
  const handleLogin = async () => {
    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem('jwtToken', data.token);
        setLoginError('');
        setInputMessage(''); // 登录成功后清空输入框
      } else {
        const errorData = await response.json();
        console.log(errorData,'失败信息');
        setLoginError(errorData.error || '登录失败');
      }
    } catch (error) {
      console.error('发送登录请求时出错:', error);
      setLoginError('发送登录请求时出错');
    }
  };

  // 处理注销
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('jwtToken');
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setMessages([]); // 清空聊天记录
    currentAiMessageIdRef.current = null; // 确保在注销时清空ref
    setInputMessage(''); // 注销时清空输入框内容
  };

  // 处理展开/收起深度思考过程
  const toggleThinkingProcess = (messageId) => {
    suppressAutoScrollRef.current = true; // 用户手动展开/收起不触发滚动到底部
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isThinkingProcessExpanded: !msg.isThinkingProcessExpanded } : msg
    ));
    // 展开后将对应区域滚到可视区域内
    setTimeout(() => scrollThinkingIntoView(messageId), 0);
  };

  return (
    <div className="chat-window">
      {!token ? (
        <div className="auth-container">
          <h2>登录</h2>
          {loginError && <div className="login-error">{loginError}</div>}
          <div className="auth-form">
            <input
              type="text"
              placeholder="用户名"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="密码"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button onClick={handleLogin}>登录</button>
          </div>
        </div>
      ) : (
        <>
          <div className="chat-header">
            <h2>ChatBot</h2>
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '已连接' : '未连接'}
            </div>
            <button onClick={handleLogout} className="logout-button">注销</button>
          </div>
          
          <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                {message.type === 'ai' && message.thinkingProcess && ( // 渲染每个AI消息的深度思考过程
                  <div className="thinking-process-wrapper" id={`thinking-${message.id}`}>
                    <div className="thinking-process-header-toggle" onClick={() => toggleThinkingProcess(message.id)}>
                      <span>
                        {message.thinkingProcessStatus === 'generating'
                          ? '思考中...'
                          : message.thinkingProcessStatus === 'completed'
                            ? '已完成深度思考'
                            : 'AI 思考过程' // 默认或未开始的状态
                        }
                      </span>
                      <span className={message.isThinkingProcessExpanded ? 'expanded' : ''}>{message.isThinkingProcessExpanded ? '▲' : '▼'}</span>
                    </div>
                    {message.isThinkingProcessExpanded && ( 
                      <div className="thinking-process-content">
                        {message.thinkingProcess}
                      </div>
                    )}
                  </div>
                )}
                {/* 仅在非AI消息或AI消息的实际回答可见时渲染 message-content */}
                {message.type !== 'ai' || message.showActualAnswer ? (
                  <div className="message-content">
                    {message.type === 'ai' && message.isThinking && !message.showActualAnswer ? (
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                ) : null /* AI消息在思考过程中，且实际回答不可见时，不渲染气泡内容 */}
                <div className="message-time">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="input-area">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              rows="2"
            />
            <button 
              onClick={sendMessage} 
              disabled={!inputMessage.trim()}
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatWindow;