const express = require('express');
const router = express.Router();
const auth = require('../lib/auth');
const healthMonitor = require('../services/health-monitor');
const wsHandler = require('../lib/ws-handler');

// 获取所有 Agent 状态
// 返回的每个 agent 包含 name（纯 ASCII id）和 display_name（带 emoji 的展示名）
router.get('/agents/status', auth.requireAuth, (req, res) => {
  const statuses = healthMonitor.getStatuses();
  const connected = wsHandler.getConnectedAgents();  // 返回的是纯 ASCII id 列表
  const result = statuses.map(s => ({
    ...s,
    connected: connected.includes(s.name),  // s.name 就是纯 ASCII id
  }));
  res.json({ agents: result });
});

// 向指定 Agent 发送远程命令
// :name 参数是纯 ASCII id（如 "ARIA"），不含 emoji
router.post('/agents/:name/command', auth.requireAuth, async (req, res) => {
  const { name } = req.params;
  const { cmd, payload } = req.body;

  // 白名单验证：只允许指定的命令
  const allowedCommands = ['status', 'restart', 'ping', 'execute', 'config_update'];
  if (!allowedCommands.includes(cmd)) {
    return res.status(400).json({ error: `未知命令: ${cmd}。允许: ${allowedCommands.join(', ')}` });
  }

  try {
    const result = await wsHandler.sendCommand(name, cmd, payload);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取当前在线的 Agent 列表（纯 ASCII id）
router.get('/agents/connected', auth.requireAuth, (req, res) => {
  res.json({ agents: wsHandler.getConnectedAgents() });
});

module.exports = router;
