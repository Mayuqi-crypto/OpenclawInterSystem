const express = require('express');
const router = express.Router();
const auth = require('../lib/auth');
const healthMonitor = require('../services/health-monitor');
const wsHandler = require('../lib/ws-handler');

// Get all agent statuses
router.get('/agents/status', auth.requireAuth, (req, res) => {
  const statuses = healthMonitor.getStatuses();
  const connected = wsHandler.getConnectedAgents();
  const result = statuses.map(s => ({
    ...s,
    connected: connected.includes(s.name),
  }));
  res.json({ agents: result });
});

// Send command to agent
router.post('/agents/:name/command', auth.requireAuth, async (req, res) => {
  const { name } = req.params;
  const { cmd, payload } = req.body;

  const allowedCommands = ['status', 'restart', 'ping', 'execute', 'config_update'];
  if (!allowedCommands.includes(cmd)) {
    return res.status(400).json({ error: `Unknown command: ${cmd}. Allowed: ${allowedCommands.join(', ')}` });
  }

  try {
    const result = await wsHandler.sendCommand(name, cmd, payload);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get connected agents list
router.get('/agents/connected', auth.requireAuth, (req, res) => {
  res.json({ agents: wsHandler.getConnectedAgents() });
});

module.exports = router;
