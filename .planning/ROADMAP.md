# Roadmap — OIS v2.0

**Milestone:** v2.0 — From Group Chat to Control Plane
**Created:** 2026-02-11
**Phases:** 6

---

## Phase 1: Foundation (Module Extraction + Data Layer + Security)

**Goal:** Split monolithic server.js and index.html into clean modules, add SQLite persistence, fix security issues. Zero new features — pure refactor + hardening.

**Requirements:** REQ-F01 through REQ-F09

**Deliverables:**
- `server.js` reduced to ~40 lines (entry point only)
- `lib/config.js`, `lib/auth.js`, `lib/state.js`, `lib/ws-handler.js`
- `routes/chat.js`, `routes/files.js`, `routes/upload.js`
- `services/chat-service.js`
- SQLite database replacing JSON/markdown chat storage
- Session persistence (survive restart)
- helmet + express-rate-limit middleware
- Path traversal fix
- Frontend split: `public/js/`, `public/css/` per feature
- All sync fs calls replaced with async in request handlers

**Success Criteria:**
- All existing features work identically after refactor
- Server restart preserves sessions and chat history
- No sync fs calls in request/WS handlers
- Rate limiting active on login endpoint

**Estimated Effort:** 2-3 sessions
**Risk:** LOW

---

## Phase 2: Agent Health Monitoring

**Goal:** Make agent status visible. Show who's online, alert when agents go down.

**Requirements:** REQ-H01 through REQ-H08

**Deliverables:**
- `services/health-monitor.js` — track agent connection state
- `routes/agents.js` — GET /api/agents/status
- Frontend: online/offline indicators next to agent names
- Frontend: health dashboard panel (status, last seen, uptime)
- Agent connect/disconnect broadcast to all clients
- SQLite health snapshots
- Chat alert on agent offline (3 missed heartbeats)

**Success Criteria:**
- UI shows green/red dot per agent
- Agent disconnect triggers visible alert in chat within 90 seconds
- Health dashboard shows current status of all agents

**Estimated Effort:** 2-3 sessions
**Risk:** LOW
**Depends on:** Phase 1

---

## Phase 3: File Management UI

**Goal:** Build frontend for existing file backend APIs. Users can browse, upload, download, delete files from the web UI.

**Requirements:** REQ-FM01 through REQ-FM07

**Deliverables:**
- File browser panel: directory tree, file list with size/date
- Upload UI: drag-drop + button, target directory selection
- Download button per file
- Delete with confirmation dialog
- Image preview (thumbnail + lightbox)
- Chat file attachments (send files in messages)

**Success Criteria:**
- Can upload a file to a specific directory via UI
- Can browse directories and download files
- Image files show thumbnail preview
- Delete shows confirmation, file is removed

**Estimated Effort:** 1-2 sessions
**Risk:** LOW
**Depends on:** Phase 1

---

## Phase 4: Task Automation + Follow-Up

**Goal:** Track tasks assigned to agents. Auto-remind when overdue. No more fire-and-forget @mentions.

**Requirements:** REQ-T01 through REQ-T07

**Deliverables:**
- `services/task-scheduler.js` — timer loop, follow-up logic
- `routes/tasks.js` — CRUD API
- SQLite tasks table
- node-cron for periodic task checks
- Frontend: task list panel (create, view, update status)
- Auto chat reminders for overdue tasks
- Idempotent task checks (state before action)

**Success Criteria:**
- Can create a task with assignee and deadline
- Overdue task triggers automatic reminder in chat
- Task status visible in UI
- Tasks persist across server restart

**Estimated Effort:** 2-3 sessions
**Risk:** MEDIUM
**Depends on:** Phase 1, Phase 2 (agent registry)

---

## Phase 5: Persistent Memory (Personal + Team)

**Goal:** Agents can store and recall knowledge across sessions. Team-wide shared knowledge base.

**Requirements:** REQ-M01 through REQ-M06

**Deliverables:**
- `services/memory-store.js` — read, write, search, delete
- `routes/memory.js` — REST endpoints for team + personal memory
- SQLite memories table (agent, category, content, metadata, importance)
- Search by prefix, tags, full-text
- Frontend: memory browser panel
- Access tracking (count + last_accessed)

**Success Criteria:**
- Agent can store a memory entry via API
- Agent can recall memories by category or search query
- Team memories visible to all agents
- Personal memories scoped per agent
- Memory persists across server restart

**Estimated Effort:** 1-2 sessions
**Risk:** MEDIUM
**Depends on:** Phase 1

---

## Phase 6: Remote Control Panel

**Goal:** Send commands to agents from the web UI. No more SSH for basic ops.

**Requirements:** REQ-R01 through REQ-R07

**Deliverables:**
- `services/agent-control.js` — command dispatch, timeout, ack
- Extended `routes/agents.js` — POST /api/agents/:name/command
- Whitelisted operations (status, restart, execute predefined)
- 30-second command timeout
- Frontend: control panel with buttons per agent
- Audit log for all remote actions
- Updated agent-side monitor scripts (handle command messages)

**Success Criteria:**
- Can send "status" command to connected agent and receive response
- Can send "restart" command with admin auth
- All commands logged with user, target, result
- Timeout after 30s returns error to UI

**Estimated Effort:** 1-2 sessions
**Risk:** MEDIUM-HIGH (security-sensitive)
**Depends on:** Phase 1, Phase 2

---

## Dependency Graph

```
Phase 1 (Foundation)
  ├──► Phase 2 (Health)
  │      ├──► Phase 4 (Tasks) — needs agent registry
  │      └──► Phase 6 (Remote Control) — needs agent tracking
  ├──► Phase 3 (Files) — independent after Phase 1
  └──► Phase 5 (Memory) — independent after Phase 1
```

## Phase Execution Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
Foundation   Health      Files       Tasks       Memory      Control
```

Note: Phases 3 and 5 are independent of Phases 2/4/6 and could be parallelized, but sequential execution is recommended for a single developer.
