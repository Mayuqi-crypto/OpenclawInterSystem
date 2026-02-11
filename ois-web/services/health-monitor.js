const db = require('../lib/db');

// In-memory tracking for real-time status
const liveStatus = new Map();

function onAgentConnect(agentName, displayName) {
  liveStatus.set(agentName, {
    status: 'online',
    connectedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  });
  db.updateAgentStatus(agentName, 'online', displayName);
}

function onAgentDisconnect(agentName) {
  const entry = liveStatus.get(agentName);
  if (entry) {
    entry.status = 'offline';
    entry.disconnectedAt = new Date().toISOString();
  }
  db.updateAgentStatus(agentName, 'offline');
}

function getStatuses() {
  const dbStatuses = db.getAgentStatuses();
  return dbStatuses.map(s => {
    const live = liveStatus.get(s.name);
    return {
      name: s.name,
      display_name: s.display_name,
      status: live ? live.status : s.status,
      last_seen: live ? live.lastSeen : s.last_seen,
      connected_at: live ? live.connectedAt : s.connected_at,
      error_count: s.error_count,
    };
  });
}

function isOnline(agentName) {
  const live = liveStatus.get(agentName);
  return live && live.status === 'online';
}

module.exports = { onAgentConnect, onAgentDisconnect, getStatuses, isOnline };
