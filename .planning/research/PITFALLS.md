# Pitfalls Research

**Domain:** Multi-agent management platform (Node.js chat system evolving into ops dashboard)
**Project:** OIS - OpenClaw Inter-System
**Researched:** 2026-02-11
**Overall confidence:** HIGH (derived from direct codebase analysis + domain experience)

---

## Architecture Pitfalls

### CRITICAL-1: God File Monolith (server.js)

**What goes wrong:** server.js is currently 375 lines handling authentication, WebSocket management, file operations, chat history, upload handling, and API routes. Adding health monitoring, scheduled tasks, remote control, and persistent memory will push it past 1000+ lines. At that point, every change risks breaking unrelated features, debugging becomes archaeology, and onboarding new contributors is painful.

**Why it happens:** "Just one more endpoint" thinking. Each feature is small individually, but they accumulate. Vanilla Node.js without a framework encourages putting everything in one file because there is no enforced structure.

**Consequences:**
- Merge conflicts on every change (single file)
- Cannot test features in isolation
- Circular dependencies emerge when extracting later
- Memory of "what touches what" exceeds human capacity

**Warning signs:**
- server.js exceeds 500 lines
- You need to scroll to find the function you want to edit
- A bug fix in chat breaks file upload
- You avoid refactoring because "it might break something else"

**Prevention:**
Extract into modules NOW, before adding features. Recommended structure:
```
ois-web/
  server.js          (entry point, <50 lines: imports + listen)
  routes/
    auth.js           (login, verify, sessions)
    chat.js           (chat history, messages)
    files.js          (file CRUD, upload, download)
    health.js         (new: agent health endpoints)
    tasks.js          (new: scheduled task endpoints)
    control.js        (new: remote control endpoints)
  services/
    session-store.js  (session management)
    chat-store.js     (chat persistence)
    ws-manager.js     (WebSocket connections + broadcast)
    agent-monitor.js  (new: health monitoring logic)
    task-scheduler.js (new: cron/interval logic)
    memory-store.js   (new: persistent memory)
  middleware/
    auth.js           (getUser, requireAuth)
```

**Which phase should address it:** Phase 1 (Foundation). Must happen before ANY new feature work. Every subsequent phase depends on clean separation.

---

### CRITICAL-2: In-Memory State Loss on Restart

**What goes wrong:** Three critical data stores are in-memory with no durable backing:
1. `sessions = new Map()` (line 39) -- all users logged out on restart
2. `chatHistory = []` (line 126) -- partial persistence via JSON file, but lossy
3. Future agent health state, task schedules, memory data -- will also be lost

**Why it happens:** In-memory is the fastest path to "it works." The JSON file write (`saveChat()` on line 162) is a half-measure that silently swallows errors (`catch (e) {}`).

**Consequences:**
- Server restart = all users must re-login
- Scheduled tasks vanish
- Agent health baselines reset
- Persistent memory (the whole point of a feature) is not persistent
- Crash during `writeFileSync` can corrupt the JSON file (partial write)

**Warning signs:**
- Users complain about being logged out randomly
- After VPS restart, all scheduled tasks are gone
- Chat history has gaps after crashes
- JSON file contains truncated/malformed data

**Prevention:**
- Phase 1: Replace `new Map()` sessions with file-backed store (SQLite or JSON with atomic writes)
- Phase 1: Replace `chatHistory` array with append-only file or SQLite
- Use atomic write pattern: write to temp file, then rename (rename is atomic on Linux)
- For persistent memory: use SQLite from day one (single file, zero config, perfect for single-VPS)

**Which phase should address it:** Phase 1 (Foundation). This is prerequisite for health monitoring, tasks, and memory features.

---

### CRITICAL-3: Synchronous File I/O Blocking the Event Loop

**What goes wrong:** The codebase uses `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync`, `fs.readdirSync`, `fs.statSync`, `fs.mkdirSync`, `fs.unlinkSync`, `fs.renameSync`, and `fs.rmdirSync` throughout server.js. Every one of these blocks the entire Node.js event loop. During a sync file operation, NO WebSocket messages are processed, NO HTTP requests are served, NO health checks respond.

**Why it happens:** Sync APIs are simpler to write. `readFileSync` returns the data directly instead of requiring callbacks/promises. When the server has 2 users, nobody notices. With 10+ agents sending messages while someone browses a directory with 500 files, the server freezes.

**Consequences:**
- WebSocket heartbeats missed during large file reads -> agents disconnected
- Health check endpoints timeout -> false "agent down" alerts
- Chat messages delayed -> agents miss mentions
- Under load, the server appears to hang for seconds at a time

**Warning signs:**
- Intermittent WebSocket disconnections that resolve themselves
- Health check failures that don't correlate with actual agent problems
- "Client timeout, terminating" log messages that increase as file count grows
- Chat messages arriving in bursts instead of real-time

**Prevention:**
- Replace ALL sync fs calls with async equivalents (`fs.promises.*`)
- Use `await fs.promises.readFile()` instead of `fs.readFileSync()`
- For startup-only code (loading initial chat history), sync is acceptable
- For request handlers and WebSocket handlers, sync is NEVER acceptable
- Lint rule: ban `Sync` suffix in non-startup code paths

**Which phase should address it:** Phase 1 (Foundation). Must be fixed during the module extraction, not after.

---

### MODERATE-1: Tight Coupling Between Agent Monitor and Gateway

**What goes wrong:** The current `ois-monitor.js` (shared/) has the agent monitor directly calling the gateway via raw HTTP requests (line 25-58). Adding health monitoring means the server needs to track agent status, but the monitor is a separate process that connects AS an agent. There is no clean interface between "monitoring an agent" and "the agent's own monitor process."

**Why it happens:** The monitor was built as a standalone script for one agent (ARIA). Extending this pattern to N agents means N separate monitor processes, each with hardcoded gateway URLs and tokens.

**Consequences:**
- Health monitoring logic duplicated per agent
- No centralized view of all agent health
- Cannot correlate agent health with chat activity
- Adding a new agent requires deploying a new monitor instance

**Warning signs:**
- Copy-pasting ois-monitor.js for each new agent
- Health status only visible in individual agent logs
- No dashboard showing all agents at once
- Different monitor versions running on different agents

**Prevention:**
- Build health monitoring INTO the OIS server, not as separate per-agent scripts
- Use the existing WebSocket connection (agents already connect) to derive health
- Track: last message time, connection duration, reconnect count, response latency
- The server already sees agent connect/disconnect events (lines 267-269)

**Which phase should address it:** Phase 2 (Health Monitoring). Design the monitoring architecture before implementing.

---

### MODERATE-2: Single-File Frontend Will Become Unmaintainable

**What goes wrong:** `public/index.html` is currently 713 lines containing HTML, CSS, and JavaScript in a single file. Adding health dashboard, task management UI, remote control panel, and memory browser will push it past 2000+ lines. The vanilla JS constraint means no component system to manage complexity.

**Why it happens:** "No framework" constraint + "just add another function" habit. Vanilla JS is fine for small UIs but requires deliberate structure for larger ones.

**Consequences:**
- CSS conflicts between panels (styles leak)
- JavaScript global namespace pollution
- Cannot work on health UI without risking chat UI regression
- Load time increases as the single file grows

**Warning signs:**
- More than 5 tab panels in the UI
- CSS selectors becoming increasingly specific to avoid conflicts
- Functions with names like `loadFiles2` or `openFile_health`
- Scroll-to-find-function exceeds 3 seconds

**Prevention:**
- Split into multiple HTML pages or use a simple client-side router
- Extract CSS into separate files per panel: `chat.css`, `files.css`, `health.css`
- Extract JS into separate files per feature: `chat.js`, `files.js`, `health.js`
- Use ES modules (`<script type="module">`) to avoid global namespace
- Keep index.html as shell with `<script src="...">` includes

**Which phase should address it:** Phase 1 (Foundation) for the split. Each subsequent phase adds its own JS/CSS files.

---

## Security Pitfalls

### CRITICAL-4: Path Traversal in File API

**What goes wrong:** The file API endpoints use `path.join(OIS_ROOT, userInput)` with a `startsWith(OIS_ROOT)` check (lines 278-280, 297-299, 325-326, 344-345, 356-357, 365-366). On Windows, `path.join` normalizes paths, but there are edge cases where this check can be bypassed:
- Null bytes in paths (`%00`)
- Unicode normalization differences
- Symlinks inside OIS_ROOT pointing outside
- The check `fullPath.startsWith(OIS_ROOT)` fails if OIS_ROOT does not end with separator (e.g., `/data/data/OpenclawInterSystemEvil` would pass)

**Why it happens:** Path traversal prevention looks simple but has many edge cases. The current implementation covers the basic `../` case but misses subtleties.

**Consequences:**
- An authenticated user can read ANY file on the VPS
- An authenticated user can write/delete ANY file on the VPS
- Complete server compromise from any valid login

**Warning signs:**
- This is a silent vulnerability -- no warning signs until exploited
- Security audit or penetration test reveals it

**Prevention:**
- Use `path.resolve()` instead of `path.join()` for canonicalization
- Append path separator to OIS_ROOT before `startsWith` check
- Validate that resolved path does not contain null bytes
- Consider `chroot`-like sandboxing or using a whitelist of allowed directories
- Add integration tests with malicious path inputs

**Which phase should address it:** Phase 1 (Foundation). Security fixes must not wait.

---

### CRITICAL-5: Shared Password Authentication

**What goes wrong:** All users share a single `PASSWORD` env var (line 20). Any username + the shared password = full access. There is no per-user authentication, no role-based access control. Adding remote control (execute commands on agents) with this auth model means anyone who knows the password can control all agents.

**Why it happens:** Simplest possible auth for a small team. Fine for a chat room, dangerous for a control plane.

**Consequences:**
- Cannot audit who did what (username is self-reported, not verified)
- Cannot restrict features per user (admin vs viewer)
- One leaked password = total compromise
- Remote control feature becomes a security nightmare

**Warning signs:**
- You hesitate to add destructive operations because "anyone could trigger them"
- You want to know who deleted a file but cannot determine it
- A team member leaves and you realize everyone shares credentials

**Prevention:**
- Phase 1: Add per-user credentials (even if just username:password-hash pairs in env or JSON)
- Phase 2+: Add role-based access: `admin` (full control), `member` (chat + files), `viewer` (read-only)
- For remote control: require `admin` role
- For file deletion: require `member` or `admin`
- Log all destructive operations with authenticated username

**Which phase should address it:** Phase 1 (per-user auth), Phase 3+ (RBAC for remote control).

---

### MODERATE-3: Agent Tokens in Plain Text

**What goes wrong:** Agent tokens are stored in `.env` as plain text and compared via direct string equality (line 234). Tokens appear in process environment, log output, and potentially in error messages.

**Prevention:**
- Hash tokens before storage (store `sha256(token)` in env, hash incoming token before comparison)
- Never log tokens -- log agent names only
- Rotate tokens periodically
- Use separate tokens per capability (read-only vs write vs control)

**Which phase should address it:** Phase 1 (Foundation).

---

### MODERATE-4: File Upload Without Virus/Content Scanning

**What goes wrong:** The upload endpoint (line 56-59) limits file size to 20MB but does no content validation. An agent or user could upload executable files, scripts, or malicious content that other users might download and execute.

**Prevention:**
- Validate MIME types server-side (do not trust client `Content-Type`)
- Restrict executable file extensions (.exe, .sh, .bat, .cmd, .ps1)
- Consider ClamAV scanning for a production environment
- Store uploads outside the web root with randomized names (already done, good)

**Which phase should address it:** Phase 2 (when file management UI is enhanced).

---

## Performance Pitfalls

### CRITICAL-6: Unbounded Chat History in Memory

**What goes wrong:** `chatHistory` array (line 126) grows with every message. `MAX_HISTORY = 500` limits what is saved to disk, but `loadMarkdownHistory()` (line 136-159) loads ALL markdown files at startup and pushes parsed messages into the same array. A year of chat logs means thousands of messages in memory, all sent to new WebSocket connections.

**Why it happens:** The architecture treats chat history as a single in-memory array with no pagination.

**Consequences:**
- Memory usage grows linearly with chat volume
- New connections receive huge history payloads (line 226: `.slice(-100)`)
- `saveChat()` serializes the entire array on every single message (line 259)
- JSON.stringify on 500 messages + JSON.parse at startup = slow

**Warning signs:**
- Node.js process memory exceeds 200MB
- WebSocket connection setup takes multiple seconds
- `saveChat()` causes visible lag in message delivery
- Server restart takes longer and longer

**Prevention:**
- Use SQLite for chat storage with proper pagination
- Send only last 50 messages on connect, load more on scroll (lazy loading)
- Save individual messages (append), not the entire array
- Index by timestamp for efficient range queries
- Remove `loadMarkdownHistory()` -- migrate once, do not re-parse on every startup

**Which phase should address it:** Phase 1 (Foundation -- data layer).

---

### MODERATE-5: No Rate Limiting on Any Endpoint

**What goes wrong:** No rate limiting on login attempts (brute force), message sending (spam), file operations (DoS), or upload (disk exhaustion). A single misbehaving agent could flood the chat, fill the disk, or brute-force the shared password.

**Prevention:**
- Add rate limiting middleware (express-rate-limit, or simple in-memory counter)
- Login: max 5 attempts per IP per minute
- Messages: max 30 per user per minute
- Uploads: max 10 per user per minute, max 100MB total per hour
- File operations: max 60 per user per minute

**Which phase should address it:** Phase 1 (Foundation -- middleware).

---

### MODERATE-6: WebSocket Memory Leak via Abandoned Connections

**What goes wrong:** The heartbeat mechanism (lines 184-200) correctly terminates stale connections, but the 30-second interval means up to 30 seconds of accumulated messages sent to dead connections. More importantly, if an agent's monitor process crashes and restarts rapidly, it creates new WebSocket connections faster than the heartbeat can clean up old ones.

**Prevention:**
- Track connection count per agent token; reject if already connected
- Reduce heartbeat interval to 15 seconds for agent connections
- Log connection count periodically to detect leaks
- Set maximum concurrent connections per token (e.g., 2)

**Which phase should address it:** Phase 2 (Health Monitoring -- connection management).

---

### MINOR-1: Broadcast Sends to All Clients Including Sender

**What goes wrong:** `broadcast()` (line 177) sends to ALL WebSocket clients. The sender sees their own message echoed back. This is currently handled client-side but wastes bandwidth and can cause duplicate display bugs.

**Prevention:**
- Pass sender's `ws` to broadcast and skip it
- Or accept this as intentional (server-authoritative message flow)

**Which phase should address it:** Low priority, address when refactoring WebSocket manager.

---

## UX Pitfalls

### CRITICAL-7: No Feedback on Agent Health State

**What goes wrong:** The UI shows no indication of whether agents are online, offline, or degraded. Users mention an agent via `@ARIA` with no way to know if ARIA is connected and will see the message. The only feedback is silence -- the message goes into the void.

**Why it happens:** The server tracks agent connections (lines 233-245, 267-269) but does not expose this state to the UI.

**Consequences:**
- Users waste time waiting for responses from offline agents
- No distinction between "agent is thinking" and "agent is dead"
- Trust in the system erodes when messages go unanswered

**Warning signs:**
- Users asking "is ARIA online?" in chat
- Users sending duplicate messages hoping for a response
- Frustration with perceived unreliability

**Prevention:**
- Add online/offline indicators next to agent names in the mention bar
- Show "last seen" timestamp for each agent
- Add typing indicator or "processing" state for agents
- Broadcast agent connect/disconnect events to all clients

**Which phase should address it:** Phase 2 (Health Monitoring UI).

---

### MODERATE-7: File Manager Has No Confirmation for Destructive Actions

**What goes wrong:** The delete API (line 294-316) uses `fs.rmdirSync(fullPath, { recursive: true })` which can delete entire directory trees. While the frontend shows a `confirm()` dialog, the API itself has no protection against accidental or malicious deletion. There is no recycle bin, no undo, no backup.

**Prevention:**
- Implement soft-delete: move to `.trash/` directory instead of permanent deletion
- Add a "recent deletions" view with restore capability
- Require double confirmation for directory deletion
- Log all delete operations with user, path, and timestamp
- Consider backup snapshots before destructive operations

**Which phase should address it:** Phase 2 (File Management enhancement).

---

### MODERATE-8: No Loading States or Error Feedback in UI

**What goes wrong:** Network requests in the frontend have minimal error handling. `loadFiles()`, `openFile()`, `saveFile()` either silently fail or show raw error messages via `alert()`. No loading spinners, no retry logic, no graceful degradation.

**Prevention:**
- Add loading indicators for all async operations
- Show user-friendly error messages (not raw server errors)
- Add retry logic for transient failures
- Show connection status indicator (connected/reconnecting/disconnected)

**Which phase should address it:** Phase 2+ (each feature phase should include proper UX states).

---

## Data Persistence Pitfalls

### CRITICAL-8: No Data Migration Strategy

**What goes wrong:** The system currently stores chat in JSON files and markdown archives. Moving to SQLite or any structured store requires migrating existing data. Without a migration strategy, you either lose history or write fragile one-time scripts.

**Why it happens:** Data format decisions are made ad-hoc. Each feature picks its own storage format. Later, consolidation requires converting between incompatible formats.

**Consequences:**
- Chat history in JSON + markdown + future SQLite = three formats to maintain
- Agent health data format chosen without considering query patterns
- Memory/knowledge format locked in before understanding access patterns
- "Schema changes" in JSON files break old data silently

**Warning signs:**
- Multiple `try { JSON.parse(...) } catch {}` blocks to handle format variations
- Data from before a certain date is missing or malformed
- "Works on my machine" because dev has different data than production

**Prevention:**
- Choose SQLite as the single persistence layer from Phase 1
- Define schemas before writing data (even for JSON-in-SQLite, define the shape)
- Write migration scripts: v1 -> v2 -> v3 (never skip versions)
- Include a `schema_version` table in SQLite
- Write a one-time migration from current JSON/markdown to SQLite

**Which phase should address it:** Phase 1 (Foundation -- data layer).

---

### CRITICAL-9: Persistent Memory Format Lock-in

**What goes wrong:** Choosing the wrong format for agent persistent memory (knowledge base) early locks you into a structure that does not support the queries you need later. Common mistakes:
- Flat JSON files: no querying, no indexing, grows unbounded
- Key-value only: cannot do "find all memories about topic X"
- Unstructured text: cannot search or filter
- Too structured: agents cannot store arbitrary knowledge

**Why it happens:** Memory/knowledge systems seem simple ("just save some text") but the access patterns are complex (search by topic, recency, relevance, agent, context).

**Consequences:**
- Agents cannot find relevant memories efficiently
- Memory grows without bounds (no eviction/summarization)
- Cannot share knowledge between agents
- Rewriting the memory format means losing or laboriously converting all stored knowledge

**Prevention:**
- Use SQLite with a flexible schema:
  ```sql
  CREATE TABLE memories (
    id INTEGER PRIMARY KEY,
    agent TEXT NOT NULL,
    category TEXT,        -- 'fact', 'preference', 'event', 'skill'
    content TEXT NOT NULL,
    metadata TEXT,        -- JSON for extensibility
    created_at TEXT,
    last_accessed TEXT,
    access_count INTEGER DEFAULT 0,
    importance REAL DEFAULT 0.5
  );
  CREATE INDEX idx_agent_category ON memories(agent, category);
  CREATE INDEX idx_importance ON memories(importance DESC);
  ```
- Support both structured queries (by agent, category) and text search
- Include importance scoring for memory eviction
- Track access patterns to identify stale memories
- Design the schema to support future vector search (add embedding column later)

**Which phase should address it:** Phase 4 (Persistent Memory), but the SQLite foundation must be in Phase 1.

---

### MODERATE-9: Chat History Append-Only Without Cleanup

**What goes wrong:** `saveChat()` writes the entire chat history array to `history.json` on every message. There is no archival, no rotation, no cleanup. Over months, this file grows and grows. The `MAX_HISTORY = 500` limit helps but is applied inconsistently (markdown history is loaded without limit at startup).

**Prevention:**
- Archive old messages (>7 days) to a separate store
- Implement proper log rotation for chat
- Do not load all markdown files at startup -- query on demand
- Set hard limits on memory usage for chat state

**Which phase should address it:** Phase 1 (Foundation -- data layer).

---

### MODERATE-10: No Backup Strategy for Any Data

**What goes wrong:** A single VPS deployment means a single point of failure. Disk corruption, accidental `rm -rf`, or VPS provider issues = total data loss. No backups exist for chat history, uploaded files, agent configurations, or future memory data.

**Prevention:**
- Automated daily SQLite backup (`.backup` command or file copy while WAL mode)
- Rotate backups: keep 7 daily, 4 weekly
- Store backups on a different volume or remote (even just `scp` to another location)
- Test restore procedure periodically

**Which phase should address it:** Phase 1 (Foundation -- ops).

---

## Scheduled Task / Auto-Recovery Pitfalls

### MODERATE-11: Cron Jobs Without Idempotency

**What goes wrong:** Scheduled tasks (health checks, auto-recovery, message follow-ups) run on intervals. If the server restarts mid-execution, or if the interval fires twice due to timing, the task runs twice. Non-idempotent tasks (send a message, restart an agent) cause duplicate actions.

**Prevention:**
- Make all scheduled tasks idempotent (check state before acting)
- Use a "last run" timestamp per task in persistent storage
- Implement distributed lock (or simple file lock) for critical tasks
- Log every task execution with result

**Which phase should address it:** Phase 3 (Task Automation).

---

### MODERATE-12: Auto-Recovery Loops

**What goes wrong:** Health monitoring detects an agent is down and triggers auto-recovery (restart). The restart fails or the agent crashes again immediately. Health monitoring detects it is down again. Infinite restart loop that generates noise, wastes resources, and masks the real problem.

**Prevention:**
- Implement exponential backoff for auto-recovery (1min, 5min, 15min, 1hr)
- Set a maximum retry count per time window (max 3 restarts per hour)
- After max retries, alert human and stop auto-recovery
- Log recovery attempts with outcomes
- Distinguish between "clean restart" and "crash loop"

**Which phase should address it:** Phase 2 (Health Monitoring) or Phase 3 (Task Automation).

---

## Remote Control Pitfalls

### CRITICAL-10: Command Injection via Remote Control

**What goes wrong:** A remote control feature that executes commands on agent machines (via gateway API) is inherently dangerous. If user input flows into command strings without sanitization, it enables arbitrary command execution.

**Prevention:**
- NEVER construct shell commands from user input
- Use a whitelist of allowed operations (restart, update, status)
- Each operation is a predefined command, not user-supplied
- Require admin role + explicit confirmation for destructive operations
- Log ALL remote control actions with user, target, command, and result
- Add a "dry run" mode that shows what would happen

**Which phase should address it:** Phase 3 (Remote Control). Must be designed with security-first approach.

---

## Prevention Matrix

| Pitfall | Severity | Phase to Address | Warning Sign | Core Prevention |
|---------|----------|-----------------|--------------|-----------------|
| God File Monolith | CRITICAL | Phase 1 | server.js > 500 lines | Extract to modules before adding features |
| In-Memory State Loss | CRITICAL | Phase 1 | Data lost on restart | SQLite for all persistent data |
| Sync File I/O | CRITICAL | Phase 1 | Intermittent WS disconnects | Replace all Sync calls with async |
| Path Traversal | CRITICAL | Phase 1 | Silent until exploited | path.resolve + separator-terminated startsWith |
| Shared Password | CRITICAL | Phase 1 | Cannot audit user actions | Per-user credentials + roles |
| Unbounded Chat History | CRITICAL | Phase 1 | Growing memory usage | SQLite with pagination |
| No Migration Strategy | CRITICAL | Phase 1 | Multiple data formats | Schema versioning from day one |
| Memory Format Lock-in | CRITICAL | Phase 4 | Cannot query memories | Flexible SQLite schema with indices |
| No Agent Health UI | CRITICAL | Phase 2 | "Is ARIA online?" in chat | Online indicators + last seen |
| Command Injection | CRITICAL | Phase 3 | N/A - design phase | Whitelist operations, never shell commands |
| Monitor-Gateway Coupling | MODERATE | Phase 2 | Copy-paste per agent | Centralize monitoring in server |
| Frontend Monolith | MODERATE | Phase 1 | index.html > 1000 lines | Split JS/CSS per feature |
| Agent Token Security | MODERATE | Phase 1 | Tokens in logs | Hash before storage |
| File Upload Scanning | MODERATE | Phase 2 | Executable files uploaded | MIME validation + extension blocklist |
| No Rate Limiting | MODERATE | Phase 1 | Brute force / spam possible | express-rate-limit middleware |
| WS Memory Leak | MODERATE | Phase 2 | Rising connection count | Max connections per token |
| No Delete Undo | MODERATE | Phase 2 | Accidental data loss | Soft-delete with .trash |
| No Loading States | MODERATE | Phase 2+ | Silent failures in UI | Loading/error/success states |
| Chat Append-Only | MODERATE | Phase 1 | Growing JSON file | Archive + rotate |
| No Backup Strategy | MODERATE | Phase 1 | Single point of failure | Automated daily SQLite backups |
| Non-Idempotent Tasks | MODERATE | Phase 3 | Duplicate messages/actions | Check state before acting |
| Auto-Recovery Loops | MODERATE | Phase 2-3 | Infinite restart noise | Exponential backoff + max retries |
| Broadcast to Sender | MINOR | Any | Duplicate display bugs | Skip sender in broadcast |

---

## Phase Ordering Implications

Based on pitfall analysis, the recommended phase order is:

1. **Phase 1: Foundation** -- Address ALL critical architecture, security, and data pitfalls. Without this, every subsequent feature is built on unstable ground. This phase produces no visible features but makes everything else possible.

2. **Phase 2: Health Monitoring + File Management** -- Build on the clean architecture. Health monitoring depends on proper WebSocket management and persistent storage. File management enhancements depend on async I/O and proper auth.

3. **Phase 3: Task Automation + Remote Control** -- Highest security risk. Requires the RBAC system from Phase 1 and the health monitoring from Phase 2. Must be designed security-first.

4. **Phase 4: Persistent Memory** -- Requires the SQLite foundation from Phase 1. Most architecturally complex feature. Benefits from lessons learned in earlier phases.

**The critical lesson:** Phase 1 is non-negotiable. Skipping it to "ship features faster" guarantees a rewrite by Phase 3.

---

## Sources

- Direct codebase analysis: `ois-web/server.js` (375 lines), `ois-web/public/index.html` (713 lines), `shared/ois-monitor.js` (188 lines), `scripts/health-check.sh` (75 lines)
- Confidence: HIGH -- findings derived from actual code inspection, not external sources
- Node.js async I/O best practices: well-established domain knowledge
- SQLite for single-server persistence: well-established pattern for this deployment model
- Path traversal prevention: OWASP guidelines (well-known, stable knowledge)
