const WebSocket = require('ws');
const OIS_URL = process.env.OIS_URL || 'ws://your-server:8800';
const AGENT_TOKEN = process.env.OIS_AGENT_TOKEN || 'your-token-here';
const ws = new WebSocket(OIS_URL);
ws.on('open', () => ws.send(JSON.stringify({type:'agent_auth',token:AGENT_TOKEN})));
ws.on('message', (d) => {
  const msg = JSON.parse(d);
  if (msg.type === 'auth_ok') {
    ws.send(JSON.stringify({type:'chat', text:'Mikasa 已上线，现在可以接收和发送OIS群聊消息了！🌸'}));
    setTimeout(() => ws.close(), 500);
  } else if (msg.type === 'error') {
    console.error('WebSocket Error:', msg.message);
    ws.close();
  }
});
ws.on('error', (error) => {
  console.error('WebSocket connection error:', error);
});
ws.on('close', () => {
  console.log('WebSocket connection closed.');
});