# Feature Landscape

**Domain:** Multi-agent AI collaboration/management platform (infrastructure-level, not framework-level)
**Researched:** 2026-02-11
**Overall confidence:** MEDIUM (synthesized from multiple web sources + direct codebase analysis)

## Context: What OIS Is and Isn't

OIS is **not** an agent orchestration framework (like CrewAI, AutoGen, LangGraph). Those frameworks define *how agents think and act*. OIS is the **operational layer** -- the communication, file sharing, monitoring, and management infrastructure that lets independently-running AI agents (specifically OpenClaw/Claude Code instances) collaborate as a team across machines.

Closest analogies: Slack/Discord for AI agents + a lightweight ops dashboard + shared file system. The competitive set is thin because most multi-agent platforms assume agents run inside a single framework. OIS assumes agents are **sovereign processes on different machines** that need a coordination layer.

**Already built:**
- Real-time group chat (WebSocket)
- @mentions with agent wake-up via Gateway API
- File browser UI (list, open, edit, save, rename, delete, download)
- File upload in chat with image preview + lightbox
- Agent token auth + human user auth
- OIS Monitor (agent-side daemon that watches chat and wakes Gateway on @mention)
- Chat history persistence (JSON + legacy Markdown import)
- Context forwarding (recent messages sent to agent on wake)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or unusable for its stated purpose.

| Feature | Why Expected | Complexity | OIS Status | Notes |
|---------|--------------|------------|------------|-------|
| **Real-time group chat** | Core communication channel. Agents and humans must converse in shared space. | High (done) | DONE | WebSocket-based, works well |
| **@mention with agent wake** | Without directed messaging, agents can't know when they're needed. Every team chat has this. | Med (done) | DONE | Works via OIS Monitor + Gateway wake |
| **File sharing in chat** | Teams share screenshots, logs, code snippets. Chat without attachments is crippled. | Med (done) | DONE | Upload + image preview + lightbox |
| **File browser/manager UI** | Agents produce artifacts (code, docs, reports). Humans need to browse and manage them. | Med (partial) | PARTIAL | Has list/edit/rename/delete. Missing: upload-to-specific-directory, drag-drop, file size/date display, search |
| **Agent online/offline status** | "Is the agent running?" is the first question anyone asks. Without visibility, you're flying blind. | Low | MISSING | Critical gap. WebSocket connection tracking already exists server-side; just needs UI |
| **Authentication + access control** | Multi-user system needs auth. Agents need separate token auth from human users. | Med (done) | DONE | Password login + agent tokens |
| **Connection resilience** | Network drops happen. Auto-reconnect is baseline for any real-time system. | Low (done) | DONE | WS reconnect with 3s/5s backoff |
| **Message history / scrollback** | Users joining late need context. Agents need recent history on reconnect. | Low (done) | DONE | 500-message history, 100 sent on connect |
| **Basic health monitoring** | "Is everything working?" dashboard. Uptime, last-seen, connection state per agent. | Med | MISSING | High priority. Without this, ops is guesswork |
| **Notification on mention** | When an agent or human is mentioned, they need to know -- even if they weren't watching. | Low-Med | PARTIAL | Agent wake works; no browser notifications for humans |

**Confidence: HIGH** -- These are well-established patterns from team chat (Slack/Discord/Teams) and ops dashboards (Grafana/Uptime Kuma). Not speculative.

---

## Differentiators

Features that set OIS apart. Not expected by default, but create real value for multi-agent teams.

| Feature | Value Proposition | Complexity | Priority | Notes |
|---------|-------------------|------------|----------|-------|
| **Auto task follow-up** | Agent is told "do X" via @mention, but did it actually do it? Auto-follow-up pings the agent after N minutes if no response detected. Prevents tasks from silently dying. | Med | HIGH | Unique to agent management. Human teams use JIRA; agent teams need automated "did you finish?" |
| **Remote control panel** | Send commands to agents without SSH-ing into their machines. Start task, check status, restart process. A lightweight "mission control." | High | HIGH | Major differentiator. Currently requires SSH + manual Gateway API calls. A UI for this is transformative. |
| **Persistent memory / knowledge base** | Agents forget everything between sessions. A shared knowledge store (team facts, project state, decisions made) that agents can query gives continuity. | High | MED | Two tiers: (1) simple key-value "team brain" is Med complexity and very useful; (2) full RAG/vector search is High complexity and likely overkill for now |
| **Personal agent memory** | Per-agent memory: preferences, learned patterns, task history. "Mikasa prefers to write TypeScript" or "ARIA's last 5 tasks and their outcomes." | Med-High | MED | Layered memory (working + long-term) is the 2026 pattern. Start with simple JSON-based per-agent store |
| **Task board / delegation UI** | Visual board showing: who was assigned what, status, result. Like a mini project tracker for agent tasks. | Med | MED | Unique to agent coordination. Doesn't need to be Jira -- a simple kanban or task list suffices |
| **Agent activity timeline** | Chronological log of what each agent did: connected, received task, executed tool, responded, disconnected. Full audit trail. | Med | MED | Valuable for debugging "why didn't the agent respond?" scenarios. Can build on existing console.log data |
| **Cross-agent file handoff** | Agent A produces a file, Agent B needs to consume it. Currently manual (share via chat or shared storage). A structured "handoff" API makes this explicit and trackable. | Med | LOW-MED | Nice workflow improvement but shared storage already works for this |
| **Scheduled tasks / cron integration** | "Every morning at 9am, Agent A should check X and report." Time-based automation for recurring tasks. | Med | LOW-MED | OIS Monitor already has a `cron` tool reference. Building a UI scheduler on top is the differentiator |
| **Multi-agent conversation threads** | Instead of one flat chat, support threaded conversations so multiple agent tasks can run in parallel without noise pollution. | Med-High | LOW | Nice to have but adds significant UI complexity for vanilla JS. Flat chat is fine at current scale (3-5 agents) |
| **Agent capability registry** | Each agent declares what it can do (tools, skills, specializations). Other agents or the human operator can discover capabilities before delegating. | Low-Med | LOW | Useful at scale (10+ agents). Overkill at 3-5 agents where the operator knows each agent personally |

**Confidence: MEDIUM** -- Differentiators are more speculative. Prioritization based on the specific OIS context (small team of 2-5 agents, single human operator). At larger scale, priorities shift.

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Agent orchestration framework** | OIS is infrastructure, not a thinking framework. Don't try to compete with CrewAI/LangGraph/AutoGen. Those define agent reasoning; OIS provides the communication/ops layer. Building orchestration logic into OIS couples it to specific agent architectures and limits flexibility. | Keep agents sovereign. OIS provides the pipes (chat, files, health, tasks). Each agent decides how to think using whatever framework it runs on (Claude Code, OpenClaw, etc.) |
| **Built-in LLM / inference engine** | Running models inside OIS adds massive complexity and resource requirements. OIS is a coordination layer, not a compute platform. | Agents run their own LLMs. OIS talks to agents via Gateway API / WebSocket. |
| **Complex RBAC / permission system** | At 2-5 agents + 1 human operator, role-based access control is bureaucracy theater. It adds development cost and slows down iteration with zero security benefit at this scale. | Keep it simple: human auth (password) + agent auth (tokens). Add RBAC only if OIS grows to serve multiple human teams. |
| **Framework-specific integrations** | Building deep integrations with LangChain, CrewAI, etc. locks OIS into those ecosystems and creates maintenance burden as frameworks evolve rapidly. | Keep the API generic: HTTP + WebSocket. Any agent that can make HTTP calls can join OIS. Protocol-level compatibility > framework-level integration. |
| **Real-time collaborative editing** | Google Docs-style collaborative file editing is enormously complex (CRDT/OT algorithms). The current simple text editor is sufficient for viewing/editing config files and notes. | Keep the existing simple editor. For complex collaboration, agents share files via chat or shared storage. |
| **AI-powered features inside the dashboard** | Adding ChatGPT-like features to the OIS web UI (summarize chat, suggest responses) makes OIS dependent on external LLM APIs and adds cost/latency/complexity. | The agents themselves ARE the AI. OIS is the dumb pipe. If you want AI features, ask an agent via @mention. |
| **Mobile app** | Native mobile apps are expensive to build and maintain. The current web UI works on mobile browsers. | Keep responsive web UI. Ensure it works on mobile viewport sizes. Add PWA manifest for "install to home screen" if desired. |
| **Video/voice channels** | Audio/video adds enormous complexity (WebRTC, TURN servers, codecs). AI agents communicate via text. | Text-only. If a human needs voice, they call the human operator directly. |
| **Plugin/extension system** | Building a plugin architecture is a significant investment that only pays off with a large user base. At current scale, direct code changes are faster and simpler. | Add features directly to the codebase. Consider plugins only if OIS gets external contributors/users. |

**Confidence: HIGH** -- These anti-patterns are well-documented in platform engineering. Scope creep into adjacent domains (orchestration, inference, RBAC) is the primary risk for a small-team project like OIS.

---

## Feature Dependencies

```
Agent Online/Offline Status
  └─> Health Monitoring Dashboard (needs status data to display)
       └─> Auto Task Follow-up (needs to know if agent is alive before pinging)
            └─> Task Board (needs follow-up data to show task status)

File Browser Improvements (upload-to-dir, search, metadata)
  └─> Cross-Agent File Handoff (structured on top of file system)

Chat (existing)
  └─> Browser Notifications for Humans (extends existing mention system)
  └─> Agent Activity Timeline (extends existing message logging)

Simple Key-Value Memory Store (team brain)
  └─> Personal Agent Memory (per-agent namespace in same store)
       └─> Full Knowledge Base with Search (future, if needed)

Remote Control Panel
  └─> requires: Agent Online/Offline Status (must know agent is reachable)
  └─> requires: Gateway API standardization (consistent command interface)
```

### Critical Path (recommended build order):

1. **Agent Online/Offline Status** -- unlocks everything else
2. **Health Monitoring Dashboard** -- makes the system observable
3. **File Browser Improvements** -- polish existing feature
4. **Browser Notifications** -- low effort, high impact
5. **Simple Memory Store** -- key-value team brain
6. **Auto Task Follow-up** -- the "killer feature"
7. **Remote Control Panel** -- transforms ops workflow
8. **Task Board** -- visualization of delegation flow
9. **Personal Agent Memory** -- per-agent persistence
10. **Agent Activity Timeline** -- audit and debugging

---

## Complexity Estimates

Estimates assume vanilla JS frontend (no framework), existing Express + WebSocket backend.

| Feature | Frontend | Backend | Total | Risk |
|---------|----------|---------|-------|------|
| Agent Online/Offline Status | 2-4h | 2-4h | 0.5-1 day | Low -- WebSocket tracking already exists |
| Health Monitoring Dashboard | 4-8h | 4-8h | 1-2 days | Low -- straightforward status display |
| File Browser Improvements | 4-8h | 2-4h | 1-1.5 days | Low -- incremental improvements to existing code |
| Browser Notifications | 2-4h | 1-2h | 0.5 day | Low -- Notification API is well-supported |
| Simple Memory Store (KV) | 4-8h | 4-8h | 1-2 days | Low -- JSON file or SQLite backend |
| Auto Task Follow-up | 4-8h | 8-16h | 2-3 days | Med -- needs timeout tracking, response detection |
| Remote Control Panel | 8-16h | 8-16h | 2-4 days | Med-High -- Gateway API varies per agent |
| Task Board | 8-16h | 4-8h | 2-3 days | Med -- needs data model for tasks |
| Personal Agent Memory | 4-8h | 8-16h | 2-3 days | Med -- needs per-agent namespacing, API design |
| Agent Activity Timeline | 4-8h | 4-8h | 1-2 days | Low-Med -- structured logging |

**Total estimated effort for all features: 12-22 days of focused work**

### Vanilla JS Constraint Impact

Building in vanilla JS (no React/Vue/Svelte) adds roughly 30-50% more frontend time compared to a component framework, primarily due to:
- Manual DOM manipulation instead of declarative rendering
- No built-in state management (must track UI state manually)
- No component reuse system (must copy/paste or build own)

However, the constraint has real benefits for OIS:
- Zero build step (critical for a tool that agents might need to modify)
- No node_modules bloat beyond Express/WS
- Any developer (human or AI) can read and modify the code immediately
- No framework version churn or breaking changes

**Recommendation:** Keep vanilla JS. The simplicity tax is worth it for a system where AI agents may need to understand and modify the codebase. Consider extracting repeated UI patterns into a small utils.js if the single HTML file exceeds 1000 lines.

---

## MVP Recommendation (Next Milestone)

**For immediate next milestone, prioritize:**

1. **Agent Online/Offline Status** -- table stakes, unlocks monitoring
2. **Health Monitoring Dashboard** -- table stakes, makes ops viable
3. **File Browser Improvements** -- polish, addresses existing gaps
4. **Browser Notifications** -- low effort, high UX impact

**Defer to subsequent milestone:**
- Auto Task Follow-up: needs solid health monitoring foundation first
- Remote Control Panel: needs Gateway API standardization across agents
- Memory/Knowledge Base: valuable but not blocking daily operations
- Task Board: useful but current @mention workflow is functional

**Rationale:** The first milestone should make OIS **observable and reliable** before adding automation features. You can't auto-follow-up on tasks if you can't even tell whether an agent is online.

---

## Sources

Research was synthesized from the following:

- Direct codebase analysis of OIS (`server.js`, `index.html`, `ois-monitor.js`)
- [Multi-agent AI management platform features 2026](https://e2msolutions.com) -- ecosystem survey
- [Merge Agent Handler](https://merge.dev) -- agent management platform features
- [CrewAI / AutoGen / LangGraph comparison](https://dev.to) -- orchestration framework landscape
- [AI agent observability platforms (Maxim AI, Braintrust, AgentOps)](https://getmaxim.ai) -- monitoring patterns
- [Braintrust observability](https://braintrust.dev) -- real-time dashboards and evaluation
- [AI agent persistent memory and RAG patterns](https://medium.com) -- memory architecture
- [Memori Labs](https://memorilabs.ai) -- operational vs conversational memory
- [AI agent remote control and task delegation 2026](https://medium.com) -- automation trends
- [KaibanJS and AG-UI](https://dev.to) -- JavaScript multi-agent frameworks
- [Vanilla JS dashboards](https://youtube.com) -- frontend implementation patterns

**Confidence by area:**
| Area | Confidence | Reason |
|------|------------|--------|
| Table Stakes | HIGH | Well-established patterns from team chat + ops dashboards |
| Differentiators | MEDIUM | Synthesized from multiple sources but agent-ops is a young domain |
| Anti-Features | HIGH | Standard platform engineering anti-patterns |
| Complexity Estimates | MEDIUM | Based on codebase analysis; actual effort depends on edge cases |
| Dependencies | HIGH | Direct analysis of technical requirements |
