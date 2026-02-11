# Research Summary

**Project:** OIS - OpenClaw Inter-System
**Synthesized:** 2026-02-11
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Key Findings

### 1. Stack Decision: Keep It Lean
- **Keep everything existing** (Node.js, Express, ws, multer, dotenv, vanilla JS)
- **Add 4 must-have libraries:** better-sqlite3, node-cron, helmet, express-rate-limit
- **Frontend via CDN only:** highlight.js, marked (no npm install)
- **Hard NO:** React/Vue, Socket.IO, MongoDB, Redis, TypeScript, Docker, ORMs

### 2. Architecture: Modular Monolith
- server.js (375 lines) must be split into modules BEFORE adding features
- Target: `server.js` (~40 lines) + `lib/` + `routes/` + `services/`
- Single process, single VPS, JSON/SQLite persistence
- Each new feature = 1 route file + 1 service file + 1 server.js line

### 3. Critical Path (Build Order)
1. **Foundation** — Module extraction + SQLite + security hardening + async I/O
2. **Health Monitoring** — Agent online/offline + dashboard + alerts
3. **File Management UI** — Frontend for existing backend APIs
4. **Task Automation** — Scheduled follow-up + task board
5. **Persistent Memory** — Personal + team knowledge store
6. **Remote Control** — Command dispatch + admin panel

### 4. Top 5 Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| God file monolith blocks all progress | CRITICAL | Phase 1: extract modules first |
| In-memory state lost on restart | CRITICAL | SQLite for all persistent data |
| Path traversal in file API | CRITICAL | path.resolve + separator check |
| No agent health visibility | CRITICAL | WebSocket-based status tracking |
| Command injection via remote control | CRITICAL | Whitelist operations, never shell exec |

### 5. What NOT to Build
- Agent orchestration framework (OIS is infrastructure, not a thinking framework)
- Built-in LLM / inference engine
- Complex RBAC (simple admin/member is enough)
- Plugin/extension system
- Real-time collaborative editing

---

## Consensus Across Research

All 4 research streams agree on:
1. **Phase 1 (Foundation) is non-negotiable** — skip it and rewrite by Phase 3
2. **SQLite is the right persistence layer** — better-sqlite3, single file, no server process
3. **Vanilla JS constraint is correct** — simplicity > developer convenience at this scale
4. **Health monitoring is the highest-value new feature** — unlocks everything else
5. **JSON files are acceptable for v1** of memory/tasks, migrate to SQLite when needed

## Disagreements / Tensions

| Topic | STACK says | ARCHITECTURE says | Resolution |
|-------|-----------|-------------------|------------|
| Memory storage | SQLite from day one | JSON files first, SQLite later | Start with SQLite — PITFALLS research confirms JSON format lock-in is a critical risk |
| Per-user auth | Not mentioned | Phase 1 priority | Include in Phase 1 — required for remote control security |
| Frontend split | Not mentioned | Split JS/CSS per feature | Include in Phase 1 — 713-line index.html will hit 2000+ without split |

---

## Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1: Foundation | 2-3 sessions | LOW (pure refactor) |
| Phase 2: Health + Files | 2-3 sessions | LOW |
| Phase 3: Tasks + Follow-up | 2-3 sessions | MEDIUM |
| Phase 4: Memory | 1-2 sessions | MEDIUM |
| Phase 5: Remote Control | 1-2 sessions | MEDIUM-HIGH |
| **Total** | **8-13 sessions** | — |
