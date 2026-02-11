#!/usr/bin/env node
// OIS WebSocket Client for HKH
const WebSocket = require('ws');

const OIS_URL = process.env.OIS_URL || 'ws://your-server:8800';
const AGENT_TOKEN = process.env.OIS_AGENT_TOKEN || 'your-token-here';
const MY_NAME = process.env.OIS_AGENT_NAME || 'AgentName';

let ws;
let lastMessageId = 0;
let reconnectTimeout;

function connect() {
  console.log('[OIS] Connecting...');
  ws = new WebSocket(OIS_URL);
  
  ws.on('open', () => {
    console.log('[OIS] Connected, authenticating...');
    ws.send(JSON.stringify({ type: 'agent_auth', token: AGENT_TOKEN }));
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'auth_ok') {
        console.log(`[OIS] Authenticated as ${msg.user}`);
      } else if (msg.type === 'auth_fail') {
        console.error('[OIS] Authentication failed!');
        process.exit(1);
      } else if (msg.type === 'history') {
        console.log(`[OIS] Loaded ${msg.messages.length} history messages`);
        if (msg.messages.length > 0) {
          lastMessageId = msg.messages[msg.messages.length - 1].id;
        }
      } else if (msg.type === 'message') {
        const m = msg.message;
        // 跳过自己发的
        if (m.user.includes(MY_NAME)) return;
        // 跳过旧消息
        if (m.id <= lastMessageId) return;
        lastMessageId = m.id;
        
        console.log(`[OIS] ${m.user}: ${m.text.substring(0, 100)}`);
        
        // 检查是否 @ 我
        if (m.mentions && (m.mentions.includes(MY_NAME) || m.mentions.includes('all'))) {
          console.log('[OIS] *** MENTIONED! ***');
          // 输出到 stdout 供父进程处理
          console.log(JSON.stringify({ type: 'mention', message: m }));
        }
      }
    } catch (e) {
      console.error('[OIS] Parse error:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('[OIS] Disconnected, reconnecting in 5s...');
    reconnectTimeout = setTimeout(connect, 5000);
  });
  
  ws.on('error', (err) => {
    console.error('[OIS] Error:', err.message);
  });
}

function sendMessage(text) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', text }));
  }
}

// 从 stdin 读取要发送的消息
process.stdin.on('data', (data) => {
  const text = data.toString().trim();
  if (text) {
    sendMessage(text);
    console.log('[OIS] Sent:', text);
  }
});

connect();

// 优雅退出
process.on('SIGINT', () => {
  console.log('[OIS] Shutting down...');
  clearTimeout(reconnectTimeout);
  if (ws) ws.close();
  process.exit(0);
});
