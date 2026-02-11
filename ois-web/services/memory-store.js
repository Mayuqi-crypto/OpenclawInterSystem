const db = require('../lib/db');

function getTeamMemories(filter = {}) {
  return db.getMemories('_team', 'team', filter);
}

function upsertTeamMemory(memory) {
  return db.upsertMemory({ ...memory, agent: '_team', scope: 'team' });
}

function getAgentMemories(agent, filter = {}) {
  return db.getMemories(agent, 'personal', filter);
}

function upsertAgentMemory(agent, memory) {
  return db.upsertMemory({ ...memory, agent, scope: 'personal' });
}

function deleteMemory(id) {
  db.deleteMemory(id);
}

function search(query, scope) {
  return db.searchMemories(query, scope);
}

module.exports = { getTeamMemories, upsertTeamMemory, getAgentMemories, upsertAgentMemory, deleteMemory, search };
