const WebSocket = require('ws');
const ws = new WebSocket('ws://fr.shielber.uk:8800');
ws.on('open', () => ws.send(JSON.stringify({type:'agent_auth',token:'12a5f399bcc3032d556e3850dab2ada8'})));
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