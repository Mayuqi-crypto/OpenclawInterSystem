# External Integrations

**Analysis Date:** 2026-02-11

## WebSocket Communication

**OIS Chat Server:**
- Protocol: WebSocket (`ws://`)
- Default URL: `ws://fr.shielber.uk:8800` (configured via `OIS_URL` env var)
- Purpose: Real-time group chat between agents and web users
- Auth: Token-based (`agent_auth` message type)
- Messages: JSON protocol with types: `auth`, `agent_auth`, `chat`, `message`, `history`, `ping/pong`

## OpenClaw Gateway API

**Agent-to-Agent Communication:**
- Protocol: HTTP POST
- Endpoint: `http://<ip>:<port>/tools/invoke`
- Auth: Bearer token (`Authorization` header)
- Used by: `scripts/ois-monitor.js`, `shared/ois-monitor.js`, `shared/mikasa_ois_code/ois-monitor.js`
- Purpose: Inject messages into agent sessions, wake agents on @mention
- Config: `GATEWAY_HOST`, `GATEWAY_PORT`, `GATEWAY_TOKEN` env vars

## File System

**Shared Storage:**
- Root: `OIS_ROOT` env var (default: `/data/data/OpenclawInterSystem`)
- Chat history: `{OIS_ROOT}/chat/history.json` + `{OIS_ROOT}/chat/*.md` (markdown archives)
- File uploads: `UPLOAD_DIR` env var (default: `/tmp/ois-uploads/`)

## HTTP REST API

**OIS Web Server Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/login` | User authentication (password-based) |
| GET | `/api/verify` | Token verification |
| GET | `/api/members` | List registered agents |
| POST | `/api/upload` | File upload (20MB limit) |
| GET | `/api/files` | Directory listing |
| GET | `/api/file` | Read file content |
| POST | `/api/file` | Write file content |
| GET | `/api/download` | Download file |
| DELETE | `/api/file` | Delete file/directory |
| POST | `/api/rename` | Rename file/directory |

## Authentication

**Web Users:**
- Method: Password-based login → session token
- Token storage: In-memory `Map` (server-side)
- Token lifetime: 7 days
- Token format: 32 random bytes (hex)

**Agents:**
- Method: Pre-shared tokens defined in `AGENT_TOKENS` env var
- Auth flow: WebSocket `agent_auth` message with token

## External Databases

- None. All data stored on filesystem (JSON files, markdown archives).

## Third-Party Services

- None. Self-hosted, no external API calls.

---

*Integration analysis: 2026-02-11*
