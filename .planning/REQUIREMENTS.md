# Requirements

**Project:** OIS - OpenClaw Inter-System
**Version:** v2.0 Milestone
**Created:** 2026-02-11

---

## v1 (This Milestone)

### Foundation

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| REQ-F01 | Extract server.js into modular structure (lib/, routes/, services/) | MUST | 1 |
| REQ-F02 | Replace all sync fs calls with async (fs.promises) in request handlers | MUST | 1 |
| REQ-F03 | Add SQLite (better-sqlite3) as persistence layer for chat, sessions, tasks, memory | MUST | 1 |
| REQ-F04 | Migrate chat history from JSON/markdown to SQLite with schema versioning | MUST | 1 |
| REQ-F05 | Fix path traversal: use path.resolve + separator-terminated startsWith | MUST | 1 |
| REQ-F06 | Add helmet + express-rate-limit middleware | MUST | 1 |
| REQ-F07 | Split index.html into shell + per-feature JS/CSS files | MUST | 1 |
| REQ-F08 | Persist sessions to SQLite (survive restart) | SHOULD | 1 |
| REQ-F09 | Add per-user credentials (username:password-hash pairs) | SHOULD | 1 |

### Health Monitoring

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| REQ-H01 | Track agent online/offline status via WebSocket connection events | MUST | 2 |
| REQ-H02 | Broadcast agent connect/disconnect events to all clients | MUST | 2 |
| REQ-H03 | Show online/offline indicators in UI (member list + mention bar) | MUST | 2 |
| REQ-H04 | GET /api/agents/status endpoint returning per-agent health data | MUST | 2 |
| REQ-H05 | Health dashboard panel in frontend (status, last seen, uptime) | MUST | 2 |
| REQ-H06 | Store health snapshots in SQLite (last_seen, error_count) | SHOULD | 2 |
| REQ-H07 | Alert in chat when agent goes offline (after 3 missed heartbeats) | SHOULD | 2 |
| REQ-H08 | Max connections per agent token (prevent WS memory leak) | SHOULD | 2 |

### File Management UI

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| REQ-FM01 | File browser panel: list, navigate directories, show size/date | MUST | 3 |
| REQ-FM02 | Upload files via UI (drag-drop + button) to specific directories | MUST | 3 |
| REQ-FM03 | Download files from UI | MUST | 3 |
| REQ-FM04 | Delete files/folders from UI with confirmation | MUST | 3 |
| REQ-FM05 | Image preview in file browser (thumbnail + lightbox) | SHOULD | 3 |
| REQ-FM06 | Send file attachments in chat messages | SHOULD | 3 |
| REQ-FM07 | Soft-delete (move to .trash) instead of permanent delete | COULD | 3 |

### Task Automation

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| REQ-T01 | Task CRUD API (create, list, update status, delete) | MUST | 4 |
| REQ-T02 | Task data model: id, title, assignee, status, deadline, follow-up interval | MUST | 4 |
| REQ-T03 | Scheduled follow-up: auto-send chat reminder for overdue tasks | MUST | 4 |
| REQ-T04 | Task list panel in frontend (view, create, update status) | MUST | 4 |
| REQ-T05 | Task persistence in SQLite | MUST | 4 |
| REQ-T06 | Idempotent task execution (check state before acting) | SHOULD | 4 |
| REQ-T07 | Overdue task alerts in chat | SHOULD | 4 |

### Persistent Memory

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| REQ-M01 | Team memory API: GET/PUT/DELETE /api/memory/team | MUST | 5 |
| REQ-M02 | Personal memory API: GET/PUT/DELETE /api/memory/agent/:name | MUST | 5 |
| REQ-M03 | Memory schema in SQLite (agent, category, content, metadata, importance) | MUST | 5 |
| REQ-M04 | Search memory by key prefix, tags, or full-text | MUST | 5 |
| REQ-M05 | Memory browser panel in frontend | SHOULD | 5 |
| REQ-M06 | Access count + last_accessed tracking for memory eviction | COULD | 5 |

### Remote Control

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| REQ-R01 | Server-to-agent command dispatch via existing WebSocket | MUST | 6 |
| REQ-R02 | Whitelist of allowed operations (status, restart, execute predefined) | MUST | 6 |
| REQ-R03 | POST /api/agents/:name/command endpoint with admin auth | MUST | 6 |
| REQ-R04 | Command ack/timeout handling (30s timeout) | MUST | 6 |
| REQ-R05 | Control panel UI with command buttons per agent | MUST | 6 |
| REQ-R06 | Audit log for all remote control actions | SHOULD | 6 |
| REQ-R07 | Update agent-side monitor scripts to handle command messages | MUST | 6 |

---

## v2 (Future Milestone)

| ID | Requirement | Notes |
|----|-------------|-------|
| REQ-V2-01 | Browser notifications for human users on @mention | Low effort, high UX impact |
| REQ-V2-02 | Agent activity timeline (chronological log per agent) | Debugging tool |
| REQ-V2-03 | Task board / kanban view | Visual delegation |
| REQ-V2-04 | Scheduled tasks / cron UI | Time-based automation |
| REQ-V2-05 | Cross-agent file handoff API | Structured file sharing |
| REQ-V2-06 | Multi-agent conversation threads | Scale concern, not needed at 3-5 agents |
| REQ-V2-07 | Auto-recovery with SSH restart | Requires SSH key config per agent |
| REQ-V2-08 | Memory importance scoring + eviction | Optimization |

---

## Out of Scope

- Mobile app
- Video/voice
- OAuth/third-party login
- End-to-end encryption
- Agent orchestration framework
- Built-in LLM
- Plugin system
- Real-time collaborative editing
