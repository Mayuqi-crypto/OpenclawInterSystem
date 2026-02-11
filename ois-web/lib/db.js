const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function init(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      text TEXT NOT NULL,
      time TEXT NOT NULL,
      mentions TEXT,
      attachments TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user TEXT NOT NULL,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_status (
      name TEXT PRIMARY KEY,
      display_name TEXT,
      status TEXT DEFAULT 'offline',
      last_seen TEXT,
      connected_at TEXT,
      error_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      assignee TEXT,
      creator TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      deadline TEXT,
      follow_up_interval INTEGER DEFAULT 3600000,
      last_follow_up TEXT,
      follow_up_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      scope TEXT DEFAULT 'personal',
      category TEXT,
      key TEXT,
      content TEXT NOT NULL,
      metadata TEXT,
      importance REAL DEFAULT 0.5,
      access_count INTEGER DEFAULT 0,
      last_accessed TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(time);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
    CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent, scope);
    CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(agent, category);
  `);

  // Set schema version
  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
  if (!row) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1);
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call init() first.');
  return db;
}

// --- Messages ---
function addMessage(msg) {
  const stmt = db.prepare(
    'INSERT INTO messages (user, text, time, mentions, attachments) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    msg.user,
    msg.text,
    msg.time,
    msg.mentions ? JSON.stringify(msg.mentions) : null,
    msg.attachments ? JSON.stringify(msg.attachments) : null
  );
  return { ...msg, id: result.lastInsertRowid };
}

function getRecentMessages(limit = 100) {
  const rows = db.prepare(
    'SELECT * FROM messages ORDER BY id DESC LIMIT ?'
  ).all(limit);
  return rows.reverse().map(row => ({
    id: row.id,
    user: row.user,
    text: row.text,
    time: row.time,
    mentions: row.mentions ? JSON.parse(row.mentions) : undefined,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
  }));
}

// --- Sessions ---
function saveSession(token, user, expires) {
  db.prepare(
    'INSERT OR REPLACE INTO sessions (token, user, expires) VALUES (?, ?, ?)'
  ).run(token, user, expires);
}

function getSession(token) {
  return db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
}

function deleteExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
}

// --- Agent Status ---
function updateAgentStatus(name, status, displayName) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO agent_status (name, display_name, status, last_seen, connected_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      display_name = excluded.display_name,
      status = excluded.status,
      last_seen = excluded.last_seen,
      connected_at = CASE WHEN excluded.status = 'online' AND status != 'online' THEN excluded.connected_at ELSE connected_at END,
      error_count = CASE WHEN excluded.status = 'online' THEN 0 ELSE error_count END
  `).run(name, displayName || name, status, now, now);
}

function getAgentStatuses() {
  return db.prepare('SELECT * FROM agent_status ORDER BY name').all();
}

function incrementAgentErrors(name) {
  db.prepare('UPDATE agent_status SET error_count = error_count + 1 WHERE name = ?').run(name);
}

// --- Tasks ---
function createTask(task) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO tasks (title, assignee, creator, status, priority, deadline, follow_up_interval, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.title, task.assignee || null, task.creator || null,
    task.status || 'pending', task.priority || 'normal',
    task.deadline || null, task.follow_up_interval || 3600000,
    now, now
  );
  return { id: result.lastInsertRowid, ...task, created_at: now, updated_at: now };
}

function getTasks(filter = {}) {
  let sql = 'SELECT * FROM tasks';
  const conditions = [];
  const params = [];
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.assignee) { conditions.push('assignee = ?'); params.push(filter.assignee); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(params);
}

function getTask(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function updateTask(id, updates) {
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    if (['title', 'assignee', 'status', 'priority', 'deadline', 'follow_up_interval', 'last_follow_up', 'follow_up_count'].includes(key)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  }
  if (fields.length === 0) return null;
  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getTask(id);
}

function deleteTask(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

function getOverdueTasks() {
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM tasks
    WHERE status IN ('pending', 'in_progress')
    AND deadline IS NOT NULL AND deadline < ?
  `).all(now);
}

function getTasksNeedingFollowUp() {
  const now = Date.now();
  return db.prepare(`
    SELECT * FROM tasks
    WHERE status IN ('pending', 'in_progress')
    AND follow_up_interval > 0
  `).all().filter(task => {
    const lastFollowUp = task.last_follow_up ? new Date(task.last_follow_up).getTime() : new Date(task.created_at).getTime();
    return (now - lastFollowUp) >= task.follow_up_interval;
  });
}

// --- Memories ---
function upsertMemory(memory) {
  const now = new Date().toISOString();
  const existing = memory.key
    ? db.prepare('SELECT id FROM memories WHERE agent = ? AND scope = ? AND key = ?').get(memory.agent, memory.scope || 'personal', memory.key)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE memories SET content = ?, category = ?, metadata = ?, importance = ?, updated_at = ?
      WHERE id = ?
    `).run(
      memory.content, memory.category || null,
      memory.metadata ? JSON.stringify(memory.metadata) : null,
      memory.importance || 0.5, now, existing.id
    );
    return { ...memory, id: existing.id, updated_at: now };
  }

  const result = db.prepare(`
    INSERT INTO memories (agent, scope, category, key, content, metadata, importance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    memory.agent, memory.scope || 'personal', memory.category || null,
    memory.key || null, memory.content,
    memory.metadata ? JSON.stringify(memory.metadata) : null,
    memory.importance || 0.5, now, now
  );
  return { ...memory, id: result.lastInsertRowid, created_at: now };
}

function getMemories(agent, scope, filter = {}) {
  let sql = 'SELECT * FROM memories WHERE agent = ? AND scope = ?';
  const params = [agent, scope];
  if (filter.category) { sql += ' AND category = ?'; params.push(filter.category); }
  if (filter.prefix) { sql += ' AND key LIKE ?'; params.push(filter.prefix + '%'); }
  if (filter.search) { sql += ' AND content LIKE ?'; params.push('%' + filter.search + '%'); }
  sql += ' ORDER BY importance DESC, updated_at DESC';
  if (filter.limit) { sql += ' LIMIT ?'; params.push(filter.limit); }

  const rows = db.prepare(sql).all(...params);
  // Update access tracking
  const ids = rows.map(r => r.id);
  if (ids.length > 0) {
    const now = new Date().toISOString();
    db.prepare(`UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id IN (${ids.join(',')})`).run(now);
  }
  return rows.map(r => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }));
}

function deleteMemory(id) {
  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
}

function searchMemories(query, scope) {
  let sql = 'SELECT * FROM memories WHERE content LIKE ?';
  const params = ['%' + query + '%'];
  if (scope) { sql += ' AND scope = ?'; params.push(scope); }
  sql += ' ORDER BY importance DESC, updated_at DESC LIMIT 50';
  return db.prepare(sql).all(...params).map(r => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }));
}

function close() {
  if (db) db.close();
}

module.exports = {
  init, getDb, close,
  addMessage, getRecentMessages,
  saveSession, getSession, deleteExpiredSessions,
  updateAgentStatus, getAgentStatuses, incrementAgentErrors,
  createTask, getTasks, getTask, updateTask, deleteTask, getOverdueTasks, getTasksNeedingFollowUp,
  upsertMemory, getMemories, deleteMemory, searchMemories,
};
