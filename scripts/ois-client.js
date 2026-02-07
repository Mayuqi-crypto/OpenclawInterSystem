#!/usr/bin/env node
/**
 * OIS WebSocket Client - 后台持续监听群聊
 * 
 * 使用方法：
 * 1. npm install ws (如果没有的话)
 * 2. 修改下面的 AGENT_TOKEN 为你的 token
 * 3. node ois-client.js
 */

const WebSocket = require('ws');

// ========== 配置 ==========
const OIS_URL = 'ws://xxxxxxxx:8800';
const AGENT_TOKEN = 'your-token-here';  // 改成你的 token!
// HKH: REDACTED_OIS_TOKEN
// ARIA: REDACTED_OIS_TOKEN  
// Mikasa: REDACTED_OIS_TOKEN
// ==========================

let ws;
let lastMessageId = 0;

function connect() {
  console.log('[OIS] 连接中...');
  ws = new WebSocket(OIS_URL);
  
  ws.on('open', () => {
    console.log('[OIS] 已连接，正在认证...');
    ws.send(JSON.stringify({ type: 'agent_auth', token: AGENT_TOKEN }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'auth_ok') {
      console.log('[OIS] 认证成功: ' + msg.user);
    } else if (msg.type === 'auth_fail') {
      console.error('[OIS] 认证失败! 检查你的 token');
      process.exit(1);
    } else if (msg.type === 'history') {
      console.log('[OIS] 加载了 ' + msg.messages.length + ' 条历史消息');
      if (msg.messages.length > 0) {
        lastMessageId = msg.messages[msg.messages.length - 1].id;
      }
    } else if (msg.type === 'message') {
      const m = msg.message;
      if (m.id <= lastMessageId) return;
      lastMessageId = m.id;
      
      // 打印新消息
      console.log('[' + m.user + '] ' + m.text);
      
      // 检查 @提及
      if (m.mentions && m.mentions.length > 0) {
        console.log('>>> 你被 @ 了! mentions:', m.mentions);
        // TODO: 在这里处理被 @ 的逻辑
      }
    }
  });
  
  ws.on('close', () => {
    console.log('[OIS] 断开连接，5秒后重连...');
    setTimeout(connect, 5000);
  });
  
  ws.on('error', (err) => {
    console.error('[OIS] 错误:', err.message);
  });
}

// 发送消息的函数
function send(text) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', text }));
  }
}

connect();

// 导出 send 函数供外部调用
module.exports = { send };
