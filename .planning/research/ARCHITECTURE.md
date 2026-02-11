# Architecture Research

**Domain:** Multi-agent management platform (Node.js/Express/WebSocket)
**Researched:** 2026-02-11
**Overall confidence:** HIGH (based on direct codebase analysis + established Node.js patterns)

---

## Current Architecture

### What Exists Today

```
server.js (375 lines) — Single file, single process
├── Config & Auth Setup         (lines 1-38)    — dotenv, env parsing, AGENT_TOKENS
├── Session Management          (lines 39-101)  — in-memory Map, login/verify
├── File Upload (multer)        (lines 44-123)  — disk storage, 20MB limit
├── Chat System                 (lines 126-270) — in-memory array + JSON + markdown
│   ├── History (JSON + .md)    (lines 126-166) — dual persistence
│   ├── Mention Detection       (lines 168-175) — regex-based, hardcoded names
│   ├── Broadcast               (lines 177-182) — all connected clients
│   └── WebSocket Handler       (lines 204-270) — auth, heartbeat, chat relay
├── File CRUD API               (lines 272-369) — list/read/write/delete/rename/download
└── Server Listen               (lines 371-375) — 0.0.0.0:8800

index.html (713 lines) — Single file, vanilla JS
├── CSS Styles                  (lines 7-178)
├── HTML Structure              (lines 180-255) — login, chat, files, editor panels
└── JavaScript                  (lines 257-711) — all client logic inline
```

### Current Data Flow

```
Human User (browser)                    Agent (Node.js process)
      │                                        │
      │ POST /api/login                        │
      │──────────────────► server.js            │
      │◄────────────────── {token}              │
      │                                        │
      │ WS: {type:"auth", token}               │ WS: {type:"agent_auth", token}
      │──────────────────► WebSocket ◄──────────│
      │◄────────────────── history              │◄── history (last 50)
      │                                        │
      │ WS: {type:"chat", text}                │ WS: {type:"chat", text}
      │──────────────────► broadcast ──────────►│
      │                   │                    │
      │                   ▼                    │
      │              saveChat()                │
      │              (history.json)            │
```

### Current Pain Points

| Problem | Evidence | Severity |
|---------|----------|----------|
| **Monolithic server.js** | 375 lines, all concerns mixed | MEDIUM — grows linearly with features |
| **In-memory sessions** | `const sessions = new Map()` | HIGH — lost on restart |
| **In-memory chat** | `const chatHistory = []` | MEDIUM — JSON file backup exists but fragile |
| **Hardcoded mention names** | `/@HKH/i.test(text)` in server, regex in client | LOW — works but won't scale |
| **No health monitoring** | External bash script only | HIGH — no auto-recovery |
| **No task tracking** | Messages are fire-and-forget | HIGH — no follow-up mechanism |
| **No persistent memory** | No agent memory/context storage | HIGH — agents forget everything |
| **No agent control** | Agents connect voluntarily, no remote commands | MEDIUM — limited orchestration |

---

## Proposed Extensions

### Target Architecture: Modular Monolith

The goal is NOT microservices. It is a **modular monolith**: one process, many modules, clear boundaries.

```
ois-web/
├── server.js              ← Entry point only (~40 lines): create app, mount routers, start
├── lib/
│   ├── state.js           ← Shared in-memory state + persistence layer
│   ├── auth.js            ← Session management, token validation, middleware
│   ├── ws-handler.js      ← WebSocket connection manager + message routing
│   └── config.js          ← Environment config validation
├── routes/
│   ├── chat.js            ← Chat REST endpoints (if any) + chat logic
│   ├── files.js           ← File CRUD endpoints (existing)
│   ├── upload.js          ← Upload endpoints + multer config
│   ├── agents.js          ← Agent registry, health, control endpoints
│   ├── tasks.js           ← Task CRUD + scheduling + follow-up
│   └── memory.js          ← Persistent memory endpoints (personal + team)
├── services/
│   ├── chat-service.js    ← Chat history, broadcast, mention detection
│   ├── health-monitor.js  ← Agent health polling + auto-recovery
│   ├── task-scheduler.js  ← Scheduled task follow-up (node-cron or setInterval)
│   ├── agent-control.js   ← Remote agent command dispatch
│   └── memory-store.js    ← Persistent memory read/write (JSON files or SQLite)
├── data/                  ← Runtime data (gitignored)
│   ├── sessions.json      ← Persisted sessions (survives restart)
│   ├── tasks.json         ← Active tasks
│   └── memory/
│       ├── team.json      ← Team-wide persistent memory
│       └── agents/
│           ├── hkh.json   ← Per-agent personal memory
│           └── aria.json
├── public/
│   └── index.html         ← Frontend (unchanged for now)
└── .env
```

### Component Descriptions

#### 1. File Management (Enhancement of existing)

**What exists:** Basic CRUD on `OIS_ROOT` filesystem via REST.

**What to add:**
- File versioning (copy-on-write to `data/file-versions/`)
- File watching via `fs.watch()` for real-time sync notifications over WebSocket
- Upload to specific directories (not just `/tmp/ois-uploads/`)
- File search (simple `fs.readdir` recursive with glob matching)

**No new dependencies needed.** Node.js `fs` module is sufficient.

#### 2. Health Monitoring with Auto-Recovery

**Current state:** External bash script (`health-check.sh`) polls agents via curl. Manual, no auto-recovery.

**Proposed: `services/health-monitor.js`**

```
health-monitor.js
├── pollAgents()        — HTTP GET to each agent's Gateway every 30s
├── agentStates Map     — { agentName: { status, lastSeen, failCount, ... } }
├── onAgentDown()       — After 3 consecutive failures:
│   ├── Broadcast alert to chat
│   ├── Attempt SSH restart (if configured)
│   └── Log to data/health-log.json
├── onAgentRecovered()  — Broadcast recovery notice
└── getHealthStatus()   — Returns current state for dashboard
```

**Key decisions:**
- Use `setInterval` (not cron) for polling. 30-second interval. Configurable per agent.
- Store agent registry in `data/agents.json` instead of parsing env vars. Env vars provide auth tokens; registry provides metadata (IP, port, health config, restart command).
- Auto-recovery actions: configurable per agent. SSH restart is opt-in with key path in config.
- Health data exposed via `GET /api/health` for frontend dashboard panel.

**New dependency:** None for basic polling. Optional: `ssh2` npm package if SSH-based restart is desired.

#### 3. Scheduled Task Follow-Up

**Current state:** No task tracking. Messages vanish into chat history.

**Proposed: `services/task-scheduler.js` + `routes/tasks.js`**

```
Task Lifecycle:

  Create ──► Pending ──► Assigned ──► In Progress ──► Complete/Failed
                │              │              │
                │              │              ▼
                │              │         Follow-Up Timer
                │              │         (check every N minutes)
                │              ▼
                │         Auto-remind via chat
                ▼
           Auto-expire after deadline
```

**Data model (`data/tasks.json`):**

```json
{
  "tasks": [
    {
      "id": "task-20260211-001",
      "title": "Process batch data",
      "assignee": "ARIA",
      "creator": "HKH",
      "priority": "high",
      "status": "in_progress",
      "created": "2026-02-11T10:00:00Z",
      "deadline": "2026-02-11T18:00:00Z",
      "followUpInterval": 3600000,
      "lastFollowUp": "2026-02-11T14:00:00Z",
      "notes": []
    }
  ]
}
```

**Key decisions:**
- Use `setInterval` timers, not an external cron. The server IS the scheduler.
- Follow-up = automatic chat message ("Task X is still pending, assigned to Y. Deadline in Z hours.").
- Tasks survive restart via JSON file persistence (same pattern as chat history).
- No database. JSON files are sufficient for <1000 active tasks.
- REST API: `GET/POST/PUT/DELETE /api/tasks` for CRUD, `POST /api/tasks/:id/follow-up` for manual trigger.

**New dependency:** None. `setInterval` + `Date` is sufficient. If cron expressions are desired later, `node-cron` (~15KB) is the lightest option.

#### 4. Remote Agent Control

**Current state:** Agents connect to WebSocket voluntarily. No server-initiated commands.

**Proposed: `services/agent-control.js` + `routes/agents.js`**

```
Control Flow:

  OIS Server ──WebSocket──► Connected Agent
       │                         │
       │  {type: "command",      │
       │   cmd: "execute",       │
       │   payload: {...}}       │
       │─────────────────────►   │
       │                         │ Process command
       │   {type: "command_ack", │
       │    result: {...}}       │
       │◄─────────────────────   │
```

**Supported commands:**
- `status` — Request agent status report
- `execute` — Run a predefined task on the agent
- `restart` — Request agent self-restart
- `config_update` — Push configuration changes
- `ping` — Explicit connectivity check

**Key decisions:**
- Commands flow over the EXISTING WebSocket connection. No new protocol.
- Each connected agent's `ws` object is stored in a Map keyed by agent name.
- Server sends commands; agents respond with ack. Timeout after 30s = command failed.
- Agent-side monitor scripts (like `ois-monitor.js` in `shared/`) need to handle incoming `command` messages.
- REST API: `POST /api/agents/:name/command` for human-initiated commands from the dashboard.

**No new dependencies.**

#### 5. Persistent Memory (Personal + Team)

**Current state:** No memory. Agents have no way to store/retrieve long-term knowledge.

**Proposed: `services/memory-store.js` + `routes/memory.js`**

```
Memory Architecture:

  data/memory/
  ├── team.json              ← Shared knowledge (project context, decisions, preferences)
  └── agents/
      ├── hkh.json           ← HKH's personal memory (habits, preferences, ongoing work)
      ├── aria.json           ← ARIA's personal memory
      └── mikasa.json         ← Mikasa's personal memory
```

**Memory entry structure:**

```json
{
  "entries": [
    {
      "id": "mem-001",
      "key": "project.ois.architecture",
      "value": "Modular monolith on single VPS",
      "tags": ["architecture", "decision"],
      "created": "2026-02-11T10:00:00Z",
      "updated": "2026-02-11T10:00:00Z",
      "source": "HKH"
    }
  ]
}
```

**REST API:**
- `GET /api/memory/team` — Read team memory (filterable by key prefix, tags)
- `PUT /api/memory/team` — Upsert team memory entry
- `GET /api/memory/agent/:name` — Read agent's personal memory
- `PUT /api/memory/agent/:name` — Upsert agent's personal memory
- `DELETE /api/memory/:scope/:key` — Delete memory entry
- `GET /api/memory/search?q=...` — Full-text search across all memory

**Key decisions:**
- JSON files, not SQLite. Rationale: <10K entries expected, JSON is debuggable, no native addon compilation on VPS.
- If memory grows beyond 10K entries, migrate to SQLite (`better-sqlite3`). This is a future concern, not a launch blocker.
- Memory is separate from chat. Chat is ephemeral conversation; memory is curated knowledge.
- Agents can read/write their own memory AND team memory. Access control: agent tokens grant write to own memory + team. Human users can write to team only.

**New dependency:** None initially. Future: `better-sqlite3` if JSON performance degrades.

---

## Module Extraction Plan

### Guiding Principle

Extract by **responsibility**, not by **file type**. Each module owns its data, routes, and logic. Modules communicate through explicit function calls, not shared global state.

### Phase 1: Extract Core Infrastructure (No New Features)

This is a pure refactor. server.js goes from 375 lines to ~40 lines. Zero behavior change.

**Step 1: `lib/config.js`** — Extract env parsing + validation

```javascript
// lib/config.js
module.exports = {
  PORT: process.env.PORT || 8800,
  OIS_ROOT: process.env.OIS_ROOT || '/data/data/OpenclawInterSystem',
  UPLOAD_DIR: process.env.UPLOAD_DIR || '/tmp/ois-uploads/',
  PASSWORD: process.env.PASSWORD,
  AGENT_TOKENS: parseAgentTokens(process.env.AGENT_TOKENS),
  HEARTBEAT_INTERVAL: 30000,
};
```

**Step 2: `lib/state.js`** — Extract shared state (sessions, chat history)

```javascript
// lib/state.js — Single source of truth for in-memory state
const sessions = new Map();
const chatHistory = [];

module.exports = { sessions, chatHistory, ... };
```

**Step 3: `lib/auth.js`** — Extract auth middleware + session logic

```javascript
// lib/auth.js
function authMiddleware(req, res, next) { ... }
function getUser(req) { ... }
function createSession(username) { ... }

module.exports = { authMiddleware, getUser, createSession };
```

**Step 4: `routes/chat.js`** — Extract chat endpoints + WebSocket message handling

**Step 5: `routes/files.js`** — Extract file CRUD endpoints (lines 272-369, nearly copy-paste)

**Step 6: `routes/upload.js`** — Extract multer config + upload endpoint

**Step 7: `lib/ws-handler.js`** — Extract WebSocket connection/message handling

**Step 8: `server.js`** — Becomes entry point only:

```javascript
require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocket } = require('ws');
const config = require('./lib/config');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Mount routers
app.use('/api', require('./routes/chat'));
app.use('/api', require('./routes/files'));
app.use('/api', require('./routes/upload'));

// WebSocket
require('./lib/ws-handler')(server);

server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`OIS Web running on port ${config.PORT}`);
});
```

### Phase 2: Add New Feature Modules

After Phase 1, each new feature is a new router + service file. server.js changes by ONE line per feature:

```javascript
app.use('/api', require('./routes/agents'));    // +1 line
app.use('/api', require('./routes/tasks'));     // +1 line
app.use('/api', require('./routes/memory'));    // +1 line
```

---

## Data Flow

### Overview: How Information Moves Through the Extended System

```
                                  ┌──────────────────────────────────────────┐
                                  │              OIS Server                   │
                                  │                                          │
  Browser ──HTTP──► Express ──────┤  routes/chat.js ──► services/chat        │
  (Human)          Routers        │  routes/files.js ──► fs (OIS_ROOT)       │
                     │            │  routes/tasks.js ──► services/task-sched  │
                     │            │  routes/agents.js ──► services/agent-ctrl │
                     │            │  routes/memory.js ──► services/mem-store  │
                     │            │                                          │
                     ▼            │         lib/state.js                     │
                  lib/auth.js     │         (sessions, agentStates)          │
                     │            │              │                           │
                     ▼            │              ▼                           │
  Agent ──WS──► ws-handler.js ───┤     data/ (JSON persistence)             │
  (Node.js)    (bidirectional)    │     ├── sessions.json                    │
                     │            │     ├── tasks.json                       │
                     │            │     ├── agents.json                      │
                     │            │     └── memory/{team,agents/}.json       │
                     ▼            │                                          │
              health-monitor.js ──┤     setInterval polling                  │
              task-scheduler.js ──┤     setInterval follow-ups               │
                                  └──────────────────────────────────────────┘
```

### Specific Data Flows

#### Flow 1: Chat Message with @mention + Task Creation

```
1. Human types "@ARIA Process the data by 6pm" in browser
2. Browser sends WS: {type:"chat", text:"@ARIA Process the data by 6pm"}
3. ws-handler.js receives, calls chat-service.js
4. chat-service.js:
   a. detectMentions() → ["ARIA"]
   b. Appends to chatHistory[]
   c. saveChat() → writes history.json
   d. broadcast() → all connected WS clients (human + agents)
5. ARIA's agent monitor receives the message via WS
6. (Future) If message matches task pattern, task-scheduler.js auto-creates task
```

#### Flow 2: Health Monitor Detects Agent Down

```
1. health-monitor.js polls ARIA's Gateway: GET http://10.x.x.x:18783/status
2. Request times out (3 consecutive failures)
3. health-monitor.js:
   a. Updates agentStates["ARIA"] = { status: "offline", failCount: 3 }
   b. Calls chat-service.broadcast({ type: "alert", text: "ARIA is offline" })
   c. If autoRestart configured: SSH to ARIA's host, run restart command
   d. Logs event to data/health-log.json
4. All connected clients (browser + agents) see the alert
5. On next successful poll: broadcast recovery notice
```

#### Flow 3: Task Follow-Up Timer

```
1. task-scheduler.js runs every 60 seconds
2. For each active task with followUpInterval:
   a. If (now - lastFollowUp) > followUpInterval:
      i.  Compose reminder: "Reminder: Task 'X' assigned to ARIA. Deadline in 2h."
      ii. chat-service.broadcast(reminder)
      iii. Update lastFollowUp timestamp
      iv. Save tasks.json
3. For each task past deadline:
   a. If status !== "complete": mark as "overdue"
   b. Broadcast overdue alert
```

#### Flow 4: Memory Read/Write

```
Write (agent stores knowledge):
1. ARIA sends: PUT /api/memory/agent/aria {key: "project.status", value: "Phase 2 complete"}
2. routes/memory.js validates auth (agent token)
3. memory-store.js:
   a. Reads data/memory/agents/aria.json
   b. Upserts entry (new object, immutable pattern)
   c. Writes back to aria.json
4. Returns {ok: true}

Read (agent recalls knowledge):
1. ARIA sends: GET /api/memory/agent/aria?prefix=project
2. memory-store.js reads aria.json, filters by prefix
3. Returns matching entries

Team memory works identically but uses data/memory/team.json
```

#### Flow 5: Remote Agent Command

```
1. Human clicks "Restart ARIA" in dashboard
2. Browser sends: POST /api/agents/aria/command {cmd: "restart"}
3. routes/agents.js validates auth (human session)
4. agent-control.js:
   a. Finds ARIA's WebSocket connection in connectedAgents Map
   b. Sends: {type: "command", cmd: "restart", id: "cmd-001"}
   c. Sets 30-second timeout
5. ARIA's monitor receives command, executes restart sequence
6. ARIA responds: {type: "command_ack", id: "cmd-001", result: {ok: true}}
7. agent-control.js resolves, returns result to browser
8. If timeout: returns {ok: false, error: "Agent did not respond"}
```

---

## Build Order

Dependencies between components dictate build order. Each phase produces a deployable, testable increment.

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
Refactor    Health      Tasks       Memory      Control
(0 new      (monitoring (scheduling (persistence (remote
features)   + alerts)   + follow-up) + recall)   commands)
```

### Phase 1: Module Extraction (Prerequisite for everything)

**Duration estimate:** 1-2 sessions
**Risk:** LOW (pure refactor, no behavior change)

**Build order within phase:**
1. `lib/config.js` (no dependencies)
2. `lib/state.js` (no dependencies)
3. `lib/auth.js` (depends on: config, state)
4. `routes/files.js` (depends on: auth, config) -- easiest extraction, most self-contained
5. `routes/upload.js` (depends on: auth, config)
6. `routes/chat.js` + `services/chat-service.js` (depends on: auth, state)
7. `lib/ws-handler.js` (depends on: auth, state, chat-service)
8. `server.js` rewrite (depends on: all above)

**Validation:** Start server, verify all existing features work identically.

### Phase 2: Health Monitoring

**Duration estimate:** 1-2 sessions
**Depends on:** Phase 1 (needs `lib/state.js` for agent states, `services/chat-service.js` for broadcast)

**Build order within phase:**
1. `data/agents.json` — Agent registry (IP, port, health config). Migrate from env-only config.
2. `services/health-monitor.js` — Polling loop, state tracking, alert generation.
3. `routes/agents.js` — `GET /api/agents` (list + status), `GET /api/health` (dashboard data).
4. Frontend: Add health status panel to index.html (colored dots next to agent names).

**Why Phase 2 before Tasks:** Health monitoring is simpler (no CRUD, no scheduling), establishes the agent registry that tasks and control depend on, and provides immediate operational value.

### Phase 3: Task Management + Scheduled Follow-Up

**Duration estimate:** 2-3 sessions
**Depends on:** Phase 2 (needs agent registry for assignee validation)

**Build order within phase:**
1. `data/tasks.json` — Task storage format.
2. `services/task-scheduler.js` — Timer loop, follow-up logic, deadline checks.
3. `routes/tasks.js` — Full CRUD: create, list, update status, delete.
4. Wire follow-up messages through `chat-service.broadcast()`.
5. Frontend: Add tasks panel to index.html (task list, create form, status updates).

### Phase 4: Persistent Memory

**Duration estimate:** 1-2 sessions
**Depends on:** Phase 1 (needs auth). Independent of Phases 2-3.

**Build order within phase:**
1. `data/memory/` directory structure.
2. `services/memory-store.js` — Read, write, search, delete. JSON file I/O.
3. `routes/memory.js` — REST endpoints for team + personal memory.
4. (Optional) Frontend: Memory browser panel.

**Note:** Phase 4 could be built in parallel with Phase 2 or 3 since it has no dependency on health or tasks. However, sequential build is recommended for a single developer to avoid context switching.

### Phase 5: Remote Agent Control

**Duration estimate:** 1-2 sessions
**Depends on:** Phase 2 (needs agent registry + connected agent tracking from ws-handler)

**Build order within phase:**
1. Extend `lib/ws-handler.js` — Track connected agents in a `connectedAgents` Map.
2. `services/agent-control.js` — Command dispatch, timeout handling, ack processing.
3. `routes/agents.js` — Add `POST /api/agents/:name/command`.
4. Update agent-side monitor scripts to handle incoming `command` messages.
5. Frontend: Add command buttons to agent panel (restart, status, execute).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: God Module

**What:** Extracting server.js into modules but having one module import everything else.
**Why bad:** Creates a hidden monolith. Changes ripple through the hub module.
**Instead:** Each module depends only on what it needs. `routes/tasks.js` depends on `services/task-scheduler.js` and `lib/auth.js`, not on `routes/chat.js`.

### Anti-Pattern 2: Premature Database

**What:** Introducing SQLite or Postgres before JSON files hit their limits.
**Why bad:** Adds compilation dependencies (native addons), deployment complexity, migration burden.
**Instead:** Start with JSON files. Monitor performance. Migrate to SQLite when any single JSON file exceeds ~5MB or when concurrent writes cause corruption. Expected timeline: months to never, given the team size.

### Anti-Pattern 3: Event Bus Abstraction

**What:** Creating a pub/sub event system to decouple modules.
**Why bad:** Overengineering for a single-process app. Makes debugging harder (where did this event come from?). Adds indirection without value at this scale.
**Instead:** Direct function calls between modules. `health-monitor.js` calls `chatService.broadcast()` directly. Simple, traceable, debuggable.

### Anti-Pattern 4: Frontend Framework Migration

**What:** Rewriting index.html in React/Vue/Svelte to handle increasing UI complexity.
**Why bad:** Adds build tooling, node_modules bloat, deployment complexity. The constraint explicitly forbids this.
**Instead:** Split inline JS into separate `.js` files loaded via `<script src>`. Use vanilla web components if component isolation is needed. Keep the single HTML file as the shell.

### Anti-Pattern 5: Stateless Server Aspirations

**What:** Trying to make the server stateless (externalized sessions, Redis, etc.) for "scalability."
**Why bad:** This is a single-VPS deployment for a small team. Stateless adds infrastructure cost and complexity with zero benefit.
**Instead:** Embrace in-memory state with periodic JSON persistence. Accept that server restart loses active WebSocket connections (clients auto-reconnect in 3 seconds already).

---

## Scalability Considerations

| Concern | Current (3-5 agents) | At 20 agents | At 100+ agents |
|---------|----------------------|--------------|----------------|
| Chat history | In-memory array, fine | In-memory array, fine | SQLite for search |
| WebSocket connections | Trivial | Trivial | Still fine (ws library handles thousands) |
| Health polling | 3 HTTP requests/30s | 20 requests/30s | Stagger polls, 100 requests/30s ok |
| Task storage | JSON file, fine | JSON file, fine | SQLite if >5K tasks |
| Memory storage | JSON files, fine | JSON files grow | SQLite for search/indexing |
| File I/O concurrency | Negligible | Low | Add write queue/mutex for JSON files |

**Bottom line:** JSON files are sufficient for the foreseeable future. The architecture supports a seamless migration to SQLite per-module when needed, because each service owns its persistence.

---

## Sources

- Direct codebase analysis of `ois-web/server.js` (375 lines), `ois-web/public/index.html` (713 lines)
- Existing architecture docs: `docs/architecture.md`, `specs/message-format.md`, `examples/task-delegation.md`
- Existing scripts: `scripts/health-check.sh`, `scripts/send-message.sh`
- Node.js `fs`, `http`, `ws` module capabilities (HIGH confidence, core Node.js)
- Express Router pattern (HIGH confidence, standard Express usage)
