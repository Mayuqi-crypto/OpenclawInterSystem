const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const OIS_ROOT = '/data/data/OpenclawInterSystem';
const PORT = 8800;

const PASSWORD = 'cloudmaids2026';
const AGENT_TOKENS = {
  'hkh-token-2026': 'HKH 🐱',
  'aria-token-2026': 'ARIA ⚔️',
  'mikasa-token-2026': 'Mikasa 🌸'
};
const sessions = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
const upload = multer({ dest: '/tmp/ois-uploads/' });

// === 认证 ===
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (password === PASSWORD && username) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { user: username, expires: Date.now() + 7 * 24 * 3600 * 1000 });
    res.json({ ok: true, token, user: username });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = sessions.get(token);
  if (session && session.expires > Date.now()) {
    res.json({ ok: true, user: session.user });
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
});

function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = sessions.get(token);
  return session && session.expires > Date.now() ? session.user : null;
}

// === 聊天 ===
const chatHistory = [];
const MAX_HISTORY = 500;
const chatFile = path.join(OIS_ROOT, 'chat', 'history.json');

try {
  if (fs.existsSync(chatFile)) {
    chatHistory.push(...JSON.parse(fs.readFileSync(chatFile, 'utf8')).slice(-MAX_HISTORY));
  }
} catch (e) {}

function loadMarkdownHistory() {
  const chatDir = path.join(OIS_ROOT, 'chat');
  try {
    const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.md')).sort();
    for (const file of files) {
      const content = fs.readFileSync(path.join(chatDir, file), 'utf8');
      const regex = /## (\d+:\d+)\s*[-–]\s*(.+?)\n\n([\s\S]*?)(?=\n##|\n---|\n\n##|$)/g;
      let match;
      const dateStr = file.replace('.md', '');
      while ((match = regex.exec(content)) !== null) {
        const time = match[1], user = match[2].trim(), text = match[3].trim().substring(0, 500);
        if (text && !text.startsWith('```')) {
          chatHistory.push({
            id: Date.parse(`${dateStr}T${time}:00+08:00`) || Date.now(),
            user, text: text.split('\n')[0].substring(0, 200),
            time: new Date(`${dateStr}T${time}:00+08:00`).toISOString(),
            fromArchive: true
          });
        }
      }
    }
    chatHistory.sort((a, b) => a.id - b.id);
  } catch (e) {}
}
loadMarkdownHistory();

function saveChat() {
  try {
    fs.writeFileSync(chatFile, JSON.stringify(chatHistory.filter(m => !m.fromArchive).slice(-MAX_HISTORY), null, 2));
  } catch (e) {}
}

function detectMentions(text) {
  const mentions = [];
  if (/@HKH/i.test(text)) mentions.push('HKH');
  if (/@ARIA/i.test(text)) mentions.push('ARIA');
  if (/@Mikasa/i.test(text)) mentions.push('Mikasa');
  if (/@all/i.test(text) || /@所有人/.test(text)) mentions.push('all');
  return mentions;
}

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

// === WebSocket 心跳 ===
const HEARTBEAT_INTERVAL = 30000;

function heartbeat() {
  this.isAlive = true;
}

const pingInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      console.log('Client timeout, terminating');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => clearInterval(pingInterval));

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  
  let wsUser = null;
  let isAgent = false;
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      // 心跳响应
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      if (msg.type === 'auth') {
        const session = sessions.get(msg.token);
        if (session && session.expires > Date.now()) {
          wsUser = session.user;
          ws.send(JSON.stringify({ type: 'auth_ok', user: wsUser }));
          ws.send(JSON.stringify({ type: 'history', messages: chatHistory.slice(-100) }));
        } else {
          ws.send(JSON.stringify({ type: 'auth_fail' }));
        }
        return;
      }
      
      if (msg.type === 'agent_auth') {
        const agentName = AGENT_TOKENS[msg.token];
        if (agentName) {
          wsUser = agentName;
          isAgent = true;
          ws.send(JSON.stringify({ type: 'auth_ok', user: wsUser, isAgent: true }));
          ws.send(JSON.stringify({ type: 'history', messages: chatHistory.slice(-50) }));
          console.log('Agent connected:', wsUser);
        } else {
          ws.send(JSON.stringify({ type: 'auth_fail' }));
        }
        return;
      }
      
      if (msg.type === 'chat' && wsUser) {
        const mentions = detectMentions(msg.text);
        const chatMsg = {
          id: Date.now(),
          user: wsUser,
          text: msg.text,
          time: new Date().toISOString(),
          mentions: mentions.length > 0 ? mentions : undefined
        };
        chatHistory.push(chatMsg);
        saveChat();
        broadcast({ type: 'message', message: chatMsg });
      }
    } catch (e) {
      console.error('WS error:', e);
    }
  });
  
  ws.on('close', () => {
    if (isAgent) console.log('Agent disconnected:', wsUser);
  });
});

// === 文件 API ===
app.get('/api/files', (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  const subPath = req.query.path || '';
  const fullPath = path.join(OIS_ROOT, subPath);
  if (!fullPath.startsWith(OIS_ROOT)) return res.status(403).json({ error: 'Access denied' });
  try {
    const items = fs.readdirSync(fullPath, { withFileTypes: true })
      .filter(item => !item.name.startsWith('.') && item.name !== 'ois-web')
      .map(item => ({ name: item.name, isDir: item.isDirectory(), path: path.join(subPath, item.name) }));
    res.json({ path: subPath, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/file', (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  const filePath = req.query.path || '';
  const fullPath = path.join(OIS_ROOT, filePath);
  if (!fullPath.startsWith(OIS_ROOT)) return res.status(403).json({ error: 'Access denied' });
  try { res.json({ path: filePath, content: fs.readFileSync(fullPath, 'utf8') }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/file', (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { path: filePath, content } = req.body;
  const fullPath = path.join(OIS_ROOT, filePath);
  if (!fullPath.startsWith(OIS_ROOT)) return res.status(403).json({ error: 'Access denied' });
  try { fs.writeFileSync(fullPath, content); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OIS Web running on http://0.0.0.0:${PORT}`);
  console.log('Heartbeat interval:', HEARTBEAT_INTERVAL, 'ms');
});
