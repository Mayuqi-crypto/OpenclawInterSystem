require('dotenv').config();

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

// 从环境变量加载配置
const OIS_ROOT = process.env.OIS_ROOT || '/data/data/OpenclawInterSystem';
const PORT = process.env.PORT || 8800;
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/ois-uploads/';

const PASSWORD = process.env.PASSWORD;
if (!PASSWORD) {
  console.error('ERROR: PASSWORD not set in .env file');
  process.exit(1);
}

// 解析 AGENT_TOKENS 环境变量 (格式: token1:name1,token2:name2)
const AGENT_TOKENS = {};
if (process.env.AGENT_TOKENS) {
  process.env.AGENT_TOKENS.split(',').forEach(pair => {
    const [token, name] = pair.split(':');
    if (token && name) {
      AGENT_TOKENS[token.trim()] = name.trim();
    }
  });
} else {
  console.error('ERROR: AGENT_TOKENS not set in .env file');
  process.exit(1);
}
const sessions = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// === 文件上传配置 ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// === 静态文件服务 - 上传的文件 ===
app.use('/uploads', express.static(UPLOAD_DIR));

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


// === 成员列表 API (动态从 AGENT_TOKENS 生成) ===
app.get("/api/members", (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: "Unauthorized" });
  const members = Object.entries(AGENT_TOKENS).map(([token, display]) => {
    const name = display.replace(/\s.*/, "");
    return { name, display };
  });
  res.json({ members });
});

function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = sessions.get(token);
  return session && session.expires > Date.now() ? session.user : null;
}

// === 文件上传 API ===
app.post('/api/upload', (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileInfo = {
      url: fileUrl,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    };
    res.json({ ok: true, file: fileInfo });
  });
});

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
      
      if ((msg.type === 'chat' || msg.type === 'message') && wsUser) {
        if (msg.type === 'message') { msg.type = 'chat'; } // Force message to chat type
        const mentions = detectMentions(msg.text);
        const chatMsg = {
          id: Date.now(),
          user: wsUser,
          text: msg.text,
          time: new Date().toISOString(),
          mentions: mentions.length > 0 ? mentions : undefined,
          attachments: msg.attachments && msg.attachments.length > 0 ? msg.attachments : undefined
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

// New API: Download file
app.get('/api/download', (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  const filePath = req.query.path || '';
  const fullPath = path.join(OIS_ROOT, filePath);

  if (!fullPath.startsWith(OIS_ROOT)) return res.status(403).json({ error: 'Access denied' });
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(fullPath, path.basename(filePath), (err) => {
    if (err) {
      console.error('File download error:', err);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });
});

// New API: Delete file/directory
app.delete('/api/file', (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  const filePath = req.query.path || '';
  const fullPath = path.join(OIS_ROOT, filePath);

  if (!fullPath.startsWith(OIS_ROOT)) return res.status(403).json({ error: 'Access denied' });
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File or directory not found' });
  }

  try {
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmdirSync(fullPath, { recursive: true }); // Remove directory recursively
    } else {
      fs.unlinkSync(fullPath); // Delete file
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('File delete error:', e);
    res.status(500).json({ error: e.message });
  }
});

// New API: Rename file/directory
app.post('/api/rename', (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { oldPath, newPath } = req.body;
  const fullOldPath = path.join(OIS_ROOT, oldPath);
  const fullNewPath = path.join(OIS_ROOT, newPath);

  if (!fullOldPath.startsWith(OIS_ROOT) || !fullNewPath.startsWith(OIS_ROOT)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.existsSync(fullOldPath)) {
    return res.status(404).json({ error: 'Original file or directory not found' });
  }

  try {
    fs.renameSync(fullOldPath, fullNewPath);
    res.json({ ok: true });
  } catch (e) {
    console.error('File rename error:', e);
    res.status(500).json({ error: e.message });
  }
});

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
