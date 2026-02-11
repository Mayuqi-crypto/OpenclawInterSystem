#!/usr/bin/env node
const WebSocket = require('ws');
const http = require('http');

const OIS_URL = process.env.OIS_URL || 'ws://your-server:8800';
const AGENT_TOKEN = process.env.OIS_AGENT_TOKEN || 'your-token-here';
const MY_NAME = process.env.OIS_AGENT_NAME || 'AgentName';
const CONTEXT_COUNT = parseInt(process.env.OIS_CONTEXT_COUNT || '10');

const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '18789');
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || 'your-gateway-token-here';

let ws;
let lastMessageId = 0;
let recentMessages = []; // 保存最近的消息用于上下文
const MAX_RECENT = 30;

// === 回复接口：Gateway 调用此 HTTP 接口发送消息到 OIS 群聊 ===
const REPLY_PORT = 18790;
const replyServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/send') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);
        if (!text) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'missing text' }));
          return;
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'chat', text }));
          console.log('[Reply] 已发送到群聊:', text.substring(0, 80));
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } else {
          console.error('[Reply] WebSocket 未连接');
          res.writeHead(503);
          res.end(JSON.stringify({ error: 'ws not connected' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/send_to_user') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);
        if (!text) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'missing text' }));
          return;
        }
        // 直接注入到主 session (模拟用户消息)
        injectToSelfSession(text);
        console.log('[InjectToSelf] 消息已注入到主 session:', text.substring(0, 80));
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
replyServer.listen(REPLY_PORT, '127.0.0.1', () => {
  console.log(`[Reply] 回复接口启动: http://127.0.0.1:${REPLY_PORT}/send`);
  console.log(`[InjectToSelf] 注入接口启动: http://127.0.0.1:${REPLY_PORT}/send_to_user`);
});

// 新增函数：直接注入消息到本 Agent 的主 session
function injectToSelfSession(messageText) {
  const payload = JSON.stringify({
    tool: 'sessions_send',
    args: {
      sessionKey: 'agent:main:main', // 发送给自己（主 session）
      message: messageText
    }
  });

  const req = http.request({
    hostname: GATEWAY_HOST,
    port: GATEWAY_PORT,
    path: '/tools/invoke',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    console.log('[InjectToSelf] 状态:', res.statusCode);
  });

  req.on('error', (e) => console.error('[InjectToSelf] 错误:', e.message));
  req.write(payload);
  req.end();
}

function connect() {
  ws = new WebSocket(OIS_URL);
  
  ws.on('open', () => {
    console.log('[OIS] 连接成功');
    ws.send(JSON.stringify({ type: 'agent_auth', token: AGENT_TOKEN }));
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'auth_ok') {
        console.log('[OIS] 认证成功:', msg.user);
      } else if (msg.type === 'history' && msg.messages.length > 0) {
        lastMessageId = msg.messages[msg.messages.length - 1].id;
        // 加载历史到 recentMessages
        recentMessages = msg.messages.slice(-MAX_RECENT).map(m => ({
          user: m.user,
          text: m.text,
          time: m.time
        }));
        console.log('[OIS] 历史加载完成, lastId:', lastMessageId);
      } else if (msg.type === 'message') {
        const m = msg.message;
        if (m.id <= lastMessageId) return;
        lastMessageId = m.id;
        
        // 保存到最近消息
        recentMessages.push({ user: m.user, text: m.text, time: m.time });
        if (recentMessages.length > MAX_RECENT) recentMessages.shift();
        
        // 忽略自己发的
        if (m.user.toLowerCase().includes(MY_NAME)) return;
        
        console.log('[' + m.user + ']', m.text.substring(0, 80));
        
        // 检查是否被 @
        const mentionsLower = (m.mentions || []).map(x => x.toLowerCase());
        if (mentionsLower.includes(MY_NAME) || mentionsLower.includes('all')) {
          console.log('>>> 被 @ 了! 注入到 session（带上下文）...');
          injectToSession(m);
        }
      }
    } catch (e) {
      console.error('[OIS] 解析错误:', e.message);
    }
  });
  
  ws.on('ping', () => ws.pong());
  ws.on('close', () => {
    console.log('[OIS] 断开，5秒后重连...');
    setTimeout(connect, 5000);
  });
  ws.on('error', (e) => console.error('[OIS] 错误:', e.message));
}

function injectToSession(message) {
  // 构建上下文：最近 N 条消息（不含当前这条）
  const contextMsgs = recentMessages.slice(-(CONTEXT_COUNT + 1), -1);
  
  let contextStr = '';
  if (contextMsgs.length > 0) {
    contextStr = '--- 最近群聊上下文 ---\n';
    contextMsgs.forEach(m => {
      const t = new Date(m.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' });
      contextStr += `[${t}] ${m.user}: ${m.text}\n`;
    });
    contextStr += '--- 以上为上下文 ---\n\n';
  }
  
  const payload = JSON.stringify({
    tool: 'sessions_send',
    args: {
      sessionKey: 'agent:main:webchat',
      message: contextStr + `[OIS群聊] ${message.user}: ${message.text}`
    }
  });
  
  const req = http.request({
    hostname: GATEWAY_HOST,
    port: GATEWAY_PORT,
    path: '/tools/invoke',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    console.log('[Inject] 状态:', res.statusCode);
  });
  
  req.on('error', (e) => console.error('[Inject] 错误:', e.message));
  req.write(payload);
  req.end();
}

connect();
console.log('OIS Monitor 启动:', new Date().toISOString());
