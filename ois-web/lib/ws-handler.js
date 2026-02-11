const WebSocket = require('ws');
const config = require('./config');
const auth = require('./auth');
const chatService = require('../services/chat-service');
const healthMonitor = require('../services/health-monitor');

let wss;

// 已连接的 Agent 映射：agentId（纯 ASCII） -> WebSocket 实例
const connectedAgents = new Map();

function init(server) {
  wss = new WebSocket.Server({ server });

  // Heartbeat
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        if (ws.agentId) {
          healthMonitor.onAgentDisconnect(ws.agentId);
          connectedAgents.delete(ws.agentId);
        }
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, config.HEARTBEAT_INTERVAL);

  wss.on('close', () => clearInterval(pingInterval));

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let wsUser = null;
    let isAgent = false;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Human auth
        if (msg.type === 'auth') {
          const user = auth.verifySession(msg.token);
          if (user) {
            wsUser = user;
            ws.send(JSON.stringify({ type: 'auth_ok', user: wsUser }));
            ws.send(JSON.stringify({ type: 'history', messages: chatService.getHistory(100) }));
            // Send current agent statuses
            ws.send(JSON.stringify({ type: 'agent_statuses', agents: healthMonitor.getStatuses() }));
          } else {
            ws.send(JSON.stringify({ type: 'auth_fail' }));
          }
          return;
        }

        // Agent 认证：token → { id, displayName }
        if (msg.type === 'agent_auth') {
          const agentInfo = auth.verifyAgentToken(msg.token);
          if (agentInfo) {
            const { id, displayName } = agentInfo;
            wsUser = displayName;   // 聊天显示用 displayName（带 emoji）
            isAgent = true;
            ws.agentId = id;        // 纯 ASCII id，用于 Map key 和路由

            // 同一 agent 只允许一个连接，踢掉旧的
            const existing = connectedAgents.get(id);
            if (existing && existing.readyState === WebSocket.OPEN) {
              existing.terminate();
            }
            connectedAgents.set(id, ws);

            ws.send(JSON.stringify({ type: 'auth_ok', user: displayName, isAgent: true }));
            ws.send(JSON.stringify({ type: 'history', messages: chatService.getHistory(50) }));
            healthMonitor.onAgentConnect(id, displayName);
            broadcast({ type: 'agent_status', agent: id, status: 'online', displayName });
          } else {
            ws.send(JSON.stringify({ type: 'auth_fail' }));
          }
          return;
        }

        // Chat message
        if ((msg.type === 'chat' || msg.type === 'message') && wsUser) {
          const chatMsg = chatService.processMessage(wsUser, msg.text, msg.attachments);
          broadcast({ type: 'message', message: chatMsg });
        }

        // Command ack from agent
        if (msg.type === 'command_ack' && isAgent) {
          const { resolve } = pendingCommands.get(msg.id) || {};
          if (resolve) {
            resolve(msg.result);
            pendingCommands.delete(msg.id);
          }
        }
      } catch (e) {
        console.error('WS error:', e.message);
      }
    });

    ws.on('close', () => {
      if (isAgent && ws.agentId) {
        connectedAgents.delete(ws.agentId);
        healthMonitor.onAgentDisconnect(ws.agentId);
        broadcast({ type: 'agent_status', agent: ws.agentId, status: 'offline' });
      }
    });
  });
}

function broadcast(msg) {
  if (!wss) return;
  const payload = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

// --- 远程命令分发 ---
// 通过 agentId（纯 ASCII）查找对应的 WebSocket 连接，发送命令并等待回复
const pendingCommands = new Map();
let commandIdCounter = 0;

function sendCommand(agentId, cmd, payload) {
  return new Promise((resolve, reject) => {
    const ws = connectedAgents.get(agentId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error(`Agent ${agentId} 未连接`));
    }

    const id = `cmd-${++commandIdCounter}`;
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error('命令超时 (30s)'));
    }, 30000);

    pendingCommands.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      }
    });

    ws.send(JSON.stringify({ type: 'command', id, cmd, payload }));
  });
}

function getConnectedAgents() {
  const agents = [];
  connectedAgents.forEach((ws, id) => {
    if (ws.readyState === WebSocket.OPEN) {
      agents.push(id);
    }
  });
  return agents;
}

module.exports = { init, broadcast, sendCommand, getConnectedAgents };
