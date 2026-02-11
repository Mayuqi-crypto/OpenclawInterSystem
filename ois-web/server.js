require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./lib/config');
config.validate();

const db = require('./lib/db');
db.init(path.join(__dirname, 'data', 'ois.db'));

const app = express();
const server = http.createServer(app);

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(config.UPLOAD_DIR));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX_LOGIN,
  message: { error: 'Too many login attempts' },
});
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX_API,
});

// Routes
const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');
const uploadRoutes = require('./routes/upload');
const agentRoutes = require('./routes/agents');
const taskRoutes = require('./routes/tasks');
const memoryRoutes = require('./routes/memory');

app.use('/api', apiLimiter);
app.use('/api/login', loginLimiter);
app.use('/api', chatRoutes);
app.use('/api', fileRoutes);
app.use('/api', uploadRoutes);
app.use('/api', agentRoutes);
app.use('/api', taskRoutes);
app.use('/api', memoryRoutes);

// WebSocket
const wsHandler = require('./lib/ws-handler');
wsHandler.init(server);

// Task scheduler
const taskScheduler = require('./services/task-scheduler');
taskScheduler.init(wsHandler.broadcast);

// Cleanup expired sessions periodically
setInterval(() => db.deleteExpiredSessions(), 3600000);

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close();
  server.close();
});

server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`OIS Web v2.0 running on http://0.0.0.0:${config.PORT}`);
  console.log(`Modules: chat, files, upload, agents, tasks, memory`);
  console.log(`Database: data/ois.db (SQLite + WAL)`);
});
