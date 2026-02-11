# Technology Stack Research

**Project:** OIS (OpenClaw Inter-System) - Multi-Agent Management Platform
**Researched:** 2026-02-11
**Overall Confidence:** HIGH (current stack is well-understood; additions are battle-tested libraries)

---

## Current Stack (What Exists)

| Technology | Version | Purpose | Assessment |
|------------|---------|---------|------------|
| Node.js | (runtime) | Server runtime | KEEP. Solid foundation, no reason to change. |
| Express | ^4.18.2 | HTTP server, REST API | KEEP. Mature, minimal, does the job. |
| ws | ^8.14.2 | WebSocket server | KEEP. Lightweight, performant, already working well with heartbeat/ping-pong. |
| multer | ^1.4.5-lts.1 | File upload middleware | KEEP. Already handles multipart uploads up to 20MB. |
| dotenv | ^17.2.4 | Environment variable loading | KEEP. Standard practice. |
| Vanilla HTML/CSS/JS | N/A | Frontend (single-page) | KEEP. Hard constraint. No frameworks. |
| PM2 | (deployed) | Process management on VPS | KEEP. Already handles restart/logging. |

**Assessment:** The current stack is lean and appropriate. Nothing needs replacing. All additions below are additive -- new libraries layered on top.

---

## Recommended Additions (For New Features)

### 1. Persistent Memory / Database

**Recommendation: `better-sqlite3` ^11.x**

| Criterion | Decision |
|-----------|----------|
| What it solves | Chat history currently in JSON file (chatHistory array dumped to history.json). Agent memory, task state, health logs all need durable storage. |
| Why SQLite | Single-file database. No separate server process. Survives process restarts. Structured queries. WAL mode for concurrent reads. |
| Why `better-sqlite3` over `node-sqlite3` | Synchronous API is faster (no callback overhead), simpler code, better TypeScript support, full transaction support. |
| Why not lowdb | lowdb reads/writes entire JSON file on every operation. Fine for <100 records, breaks at scale. OIS already has 500-message history cap -- that is lowdb's ceiling. |
| Why not Redis | Requires separate server process. Overkill for a single-VPS deployment. Adds operational complexity. |
| Why not MongoDB | Requires separate server process. Heavy for a 3-agent system. |

**Confidence: HIGH** -- better-sqlite3 is the standard recommendation for embedded Node.js persistence in 2025/2026. 1.5M+ weekly npm downloads.

**Schema areas:**
- `messages` -- replaces history.json, unlimited history with pagination
- `agent_status` -- health snapshots (last_seen, uptime, error_count)
- `tasks` -- task tracking with follow-up state
- `memory` -- agent persistent memory (key-value with namespace + timestamps)
- `files_meta` -- file metadata index for search/tagging

---

### 2. Agent Health Monitoring

**No new library needed for core monitoring.** Build on existing WebSocket infrastructure.

| Component | Approach |
|-----------|----------|
| Heartbeat detection | Already implemented (30s ping/pong interval in server.js). Extend to record last_seen timestamps in SQLite. |
| Health API | New Express endpoint `/api/agents/status` returns per-agent health from DB. |
| Frontend dashboard | New vanilla JS tab. Poll `/api/agents/status` every 10-30s or receive updates via existing WS. |
| System metrics (optional) | `pidusage` (^3.0) for per-process CPU/memory if agents run as local processes. |

**Recommendation: `pidusage` ^3.0.2** (optional, only if agent processes are co-located)

| Criterion | Decision |
|-----------|----------|
| What it solves | CPU and memory usage per PID |
| Why pidusage | Cross-platform (Linux + Windows), zero dependencies, simple API |
| Why not os-utils | Less maintained, Linux-only for some features |

**Confidence: HIGH** for heartbeat-based monitoring (already working). MEDIUM for pidusage (depends on deployment topology).

---

### 3. Task Scheduling / Auto Follow-Up

**Recommendation: `node-cron` ^3.0.3**

| Criterion | Decision |
|-----------|----------|
| What it solves | Periodic task checks: "Has Agent X responded to task Y within N minutes? If not, re-ping." |
| Why node-cron | Cron-syntax scheduling, in-process (no external service), lightweight. |
| Why not Agenda | Requires MongoDB. Overkill. |
| Why not Bull/BullMQ | Requires Redis. Overkill for simple periodic checks. |
| Why not node-schedule | node-cron is simpler, more actively maintained, cron-syntax is familiar. |

**Pattern:** Store tasks in SQLite with `status`, `assigned_agent`, `deadline`, `follow_up_count`. node-cron runs every 1-5 minutes, queries overdue tasks, sends WebSocket reminder messages.

**Confidence: HIGH** -- node-cron is the standard for in-process scheduling without external dependencies.

---

### 4. Remote Control Panel

**No new backend library needed.** This is an API design + frontend concern.

| Component | Approach |
|-----------|----------|
| Agent commands | New WS message types: `agent_command` (restart, pause, config update). Server relays to specific agent connections. |
| Config management | Express endpoints for reading/updating agent configs stored in SQLite or .env-style files. |
| Auth for admin actions | Add role field to sessions (`admin` vs `member`). Gate destructive actions behind admin role check. |
| Frontend | New "Control Panel" tab in vanilla JS. Buttons/forms that call REST endpoints or send WS commands. |

**Confidence: HIGH** -- pure application logic, no special libraries needed.

---

### 5. File Management UI Enhancements

**Already mostly built.** Current server.js has: upload, download, browse, delete, rename, file read/write APIs.

| Enhancement | Approach |
|-------------|----------|
| File search | If needed: `glob` (^11.x) or `fast-glob` (^3.3) for server-side file search. |
| File preview | Frontend-only: render markdown, syntax-highlight code. Use `highlight.js` via CDN for code highlighting (no npm install needed -- load from CDN in index.html). |
| Drag-and-drop upload | Frontend-only: HTML5 drag events + existing `/api/upload` endpoint. |

**Recommendation: `fast-glob` ^3.3.3** (only if file search is needed)

**Confidence: HIGH** -- minor enhancements to existing infrastructure.

---

### 6. Security Hardening

**Recommendation: `helmet` ^8.x + `express-rate-limit` ^7.x**

| Library | Version | Purpose |
|---------|---------|---------|
| helmet | ^8.0.0 | Sets security HTTP headers (XSS protection, content-type sniffing, etc.) |
| express-rate-limit | ^7.5.0 | Rate limiting on login/API endpoints to prevent brute force |

Current issues observed in server.js:
- No rate limiting on `/api/login` (brute-forceable)
- No security headers
- Path traversal check uses `startsWith` (generally fine but helmet adds defense-in-depth)

**Confidence: HIGH** -- these are standard Express security middleware, trivial to add.

---

## Libraries to Consider (Full Summary)

### Must-Have (Install Now)

| Library | Version | Purpose | npm install |
|---------|---------|---------|-------------|
| better-sqlite3 | ^11.7.0 | Persistent database for messages, tasks, agent state, memory | `npm i better-sqlite3` |
| node-cron | ^3.0.3 | Scheduled task follow-up checks | `npm i node-cron` |
| helmet | ^8.0.0 | Security headers | `npm i helmet` |
| express-rate-limit | ^7.5.0 | API rate limiting | `npm i express-rate-limit` |

### Nice-to-Have (Install When Needed)

| Library | Version | Purpose | When |
|---------|---------|---------|------|
| pidusage | ^3.0.2 | Process CPU/memory monitoring | When building agent health dashboard for co-located agents |
| fast-glob | ^3.3.3 | Server-side file search | When adding file search feature |
| nanoid | ^5.x | Short unique IDs for tasks/memory entries | When task system is built |

### Frontend (CDN, No Install)

| Library | Version | Purpose | Load via |
|---------|---------|---------|----------|
| highlight.js | 11.x | Code syntax highlighting in file viewer | `<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.x/highlight.min.js">` |
| marked | 15.x | Markdown rendering in chat/file preview | `<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js">` |

---

## What NOT to Use (And Why)

| Technology | Why NOT |
|------------|---------|
| **React / Vue / Svelte** | Hard constraint: vanilla JS only. The frontend is a single page (~700 lines). A framework would add build tooling complexity for zero benefit at this scale. |
| **Socket.IO** | Already using `ws` successfully. Socket.IO adds 50KB+ client bundle, rooms/namespaces abstraction you don't need, and auto-fallback to polling that is unnecessary (all agents run modern Node.js clients). Switching gains nothing, costs migration effort. |
| **MongoDB / Mongoose** | Requires separate server process. A single-file SQLite database is the right choice for a VPS deployment serving 3-5 agents + a handful of human users. |
| **Redis** | Same reason as MongoDB. Adds operational complexity. If you need caching later, better-sqlite3 with WAL mode is fast enough. |
| **Bull / BullMQ** | Requires Redis. node-cron handles periodic checks in-process. |
| **Agenda** | Requires MongoDB. Same objection. |
| **Prisma / TypeORM / Sequelize** | ORMs add significant complexity and dependency weight. For a ~5 table SQLite database, raw SQL with better-sqlite3's `.prepare()` is cleaner, faster, and easier to debug. |
| **TypeScript** | The project is pure JS. Adding TS means adding a build step, tsconfig, type definitions for every dependency. Not worth it for a project of this size with a single developer. |
| **Webpack / Vite / esbuild** | No build tooling needed. The frontend is a single HTML file with inline CSS and JS. CDN scripts handle any library needs. |
| **Docker** | Already deployed via PM2 on VPS. Docker adds a layer of abstraction that provides no benefit for a single-server, single-process deployment. |
| **Passport.js** | Current auth (password + token in Map) is simple and adequate. Passport adds complexity for OAuth/SAML flows you don't need. |
| **lowdb** | Reads/writes entire JSON file. Already hitting the pattern's limits with 500-message cap. SQLite is the clear upgrade path. |
| **Express 5.x** | Still not stable for production. Stick with Express 4.x which is battle-tested. |

---

## Installation Commands

```bash
# Must-have additions
npm install better-sqlite3 node-cron helmet express-rate-limit

# Nice-to-have (install when needed)
npm install pidusage fast-glob nanoid
```

No dev dependencies needed -- the project has no build step, no tests (yet), no linting configured.

---

## Architecture Impact

Adding these libraries does NOT change the fundamental architecture:

```
Current:                          After:

  Browser (vanilla JS)             Browser (vanilla JS + new tabs)
       |                                |
   WebSocket + HTTP                 WebSocket + HTTP
       |                                |
  Express + ws                     Express + ws + helmet + rate-limit
       |                                |
  JSON files (history.json)        SQLite (better-sqlite3)
  + fs (file system)               + fs (file system)
                                   + node-cron (scheduler)
```

The server remains a single Node.js process managed by PM2. SQLite replaces JSON file storage. node-cron adds a timer loop inside the same process. No new services, no new ports, no new deployment concerns.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Database (better-sqlite3) | HIGH | Industry standard for embedded Node.js persistence. Multiple sources confirm. |
| Scheduling (node-cron) | HIGH | Well-maintained, simple, in-process. No external dependencies. |
| Security (helmet + rate-limit) | HIGH | Standard Express middleware. Official recommendations. |
| Health monitoring approach | HIGH | Built on existing heartbeat infrastructure. Minimal new code. |
| Frontend (vanilla JS) | HIGH | Modern browser APIs (fetch, querySelector, CSS Grid) are sufficient. No framework needed. |
| File management | HIGH | Existing APIs cover 90% of needs. Minor enhancements only. |
| Persistent memory | MEDIUM | Schema design and query patterns need validation during implementation. Library choice is HIGH confidence. |

---

## Sources

- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)
- [node-cron npm](https://www.npmjs.com/package/node-cron)
- [helmet npm](https://www.npmjs.com/package/helmet)
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit)
- [Node.js lightweight database comparison (dev.to)](https://dev.to)
- [WebSocket best practices 2025 (ably.com)](https://ably.com)
- [Node.js monitoring best practices 2026 (atatus.com)](https://atatus.com)
- [Vanilla JS dashboard patterns (medium.com)](https://medium.com)
