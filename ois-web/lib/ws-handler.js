const WebSocket = require('ws');
const config = require('./config');
const auth = require('./auth');
const chatService = require('../services/chat-service');
const healthMonitor = require('../services/health-monitor');

let wss;

// Connected agents map: agentName -> ws
const connectedAgents = new Map();

function init(server) {
  wss = new WebSocket.Server({ server });

  // Heartbeat
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        if (ws.agentName) {
          healthMonitor.onAgentDisconnect(ws.agentName);
          connectedAgents.delete(ws.agentName);
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

        // Agent auth
        if (msg.type === 'agent_auth') {
          const agentName = auth.verifyAgentToken(msg.token);
          if (agentName) {
            wsUser = agentName;
            isAgent = true;
            ws.agentName = agentName;

            // Check max connections per agent
            const existing = connectedAgents.get(agentName);
            if (existing && existing.readyState === WebSocket.OPEN) {
              existing.terminate(); // Close old connection
            }
            connectedAgents.set(agentName, ws);

            ws.send(JSON.stringify({ type: 'auth_ok', user: wsUser, isAgent: true }));
            ws.send(JSON.stringify({ type: 'history', messages: chatService.getHistory(50) }));
            healthMonitor.onAgentConnect(agentName, wsUser);
            broadcast({ type: 'agent_status', agent: agentName, status: 'online' });
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
      if (isAgent && ws.agentName) {
        connectedAgents.delete(ws.agentName);
        healthMonitor.onAgentDisconnect(ws.agentName);
        broadcast({ type: 'agent_status', agent: ws.agentName, status: 'offline' });
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

// --- Remote Command Dispatch ---
const pendingCommands = new Map();
let commandIdCounter = 0;

function sendCommand(agentName, cmd, payload) {
  return new Promise((resolve, reject) => {
    const ws = connectedAgents.get(agentName);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error(`Agent ${agentName} is not connected`));
    }

    const id = `cmd-${++commandIdCounter}`;
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error('Command timeout (30s)'));
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
  connectedAgents.forEach((ws, name) => {
    if (ws.readyState === WebSocket.OPEN) {
      agents.push(name);
    }
  });
  return agents;
}

module.exports = { init, broadcast, sendCommand, getConnectedAgents };
