# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

- **JavaScript (Node.js)** — Primary language for all server-side and client-side code
- **HTML/CSS** — Frontend UI (`ois-web/public/index.html`)
- **Bash** — Utility scripts (`scripts/health-check.sh`, `scripts/send-message.sh`)

## Runtime

- **Node.js** — Server runtime
- **Browser** — Client-side JavaScript (vanilla, no framework)

## Frameworks & Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | HTTP server, routing, static file serving |
| `ws` | ^8.14.2 | WebSocket server for real-time chat |
| `multer` | ^1.4.5-lts.1 | File upload handling (multipart/form-data) |
| `dotenv` | ^17.2.4 | Environment variable loading from `.env` |

## Built-in Node.js Modules Used

- `http` — HTTP server creation (shared with Express)
- `path` — File path manipulation
- `fs` — File system operations (sync)
- `crypto` — Token generation, file naming

## Configuration

**Environment Variables (`.env`):**
- `PORT` — Server port (default: 8800)
- `OIS_ROOT` — Root directory for shared files
- `UPLOAD_DIR` — Upload destination directory
- `PASSWORD` — Web login password (required)
- `AGENT_TOKENS` — Comma-separated `token:name` pairs (required)

**Configuration Files:**
- `ois-web/.env` — Runtime config (gitignored)
- `ois-web/.env.example` — Config template
- `ois-web/package.json` — Dependencies and scripts

## Package Management

- **npm** — Package manager
- `ois-web/package-lock.json` — Lockfile for deterministic installs

## Build & Run

```bash
# Install dependencies
cd ois-web && npm install

# Start server
npm start  # → node server.js
```

No build step required — plain JavaScript, no transpilation.

---

*Stack analysis: 2026-02-11*
