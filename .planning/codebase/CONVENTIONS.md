# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- `server.js`, `ois-monitor.js`: lowercase with hyphens for multi-word (if any).
- Configuration files, if present, tend to be `.{name}rc` or `.{name}.json`.

**Functions:**
- Predominantly `camelCase` (e.g., `getUser`, `saveChat`, `detectMentions`, `broadcast`, `heartbeat`, `connect`).

**Variables:**
- Local variables: `camelCase` (e.g., `wsUser`, `isAgent`, `msg`).
- Constants (especially from `process.env`): `UPPER_SNAKE_CASE` (e.g., `OIS_ROOT`, `PORT`, `PASSWORD`, `AGENT_TOKENS`, `HEARTBEAT_INTERVAL`).
- Class-like variables (though not explicitly classes, e.g., `WebSocket.Server` instance): `camelCase` (e.g., `wss`).

**Types:**
- Not applicable; this is a pure JavaScript project, not TypeScript.

## Code Style

**Formatting:**
- Indentation: 2 spaces (inferred from `server.js` and `ois-monitor.js`).
- Semicolons: Used consistently at the end of statements.
- Quotes: Single quotes generally used for strings, but some double quotes are present. No strict consistency.
- Line endings: Unix-style line endings (LF) are common.

**Linting:**
- Not detected. No `.eslintrc` or similar files found. Code style is enforced manually or by developer preference.

## Import Organization

**Order:**
1. Built-in Node.js modules (e.g., `path`, `fs`, `http`, `crypto`).
2. Third-party modules (e.g., `express`, `ws`, `multer`, `dotenv`).
The order is generally grouped by type of module.

**Path Aliases:**
- Not detected. Relative or direct module paths are used (`require('module-name')`).

## Error Handling

**Patterns:**
- `try...catch` blocks are used for synchronous operations that might throw errors (e.g., `JSON.parse`, `fs.readFileSync`, `fs.writeFileSync`).
- Asynchronous errors in Express routes and WebSocket handlers often check for an `err` object passed to a callback (e.g., `upload.single('file')(req, res, (err) => { ... })`).
- Global `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers are present in `C:/Projects/OpenclawInterSystem/shared/ois-monitor.js` for fatal error catching.
- HTTP API errors are returned with appropriate `res.status()` codes and JSON error messages (e.g., `res.status(401).json({ error: 'Unauthorized' })`).
- `console.error` is used for logging errors.
- Critical configuration errors lead to `process.exit(1)` (e.g., missing `PASSWORD` or `AGENT_TOKENS`).

## Logging

**Framework:** `console.log` and `console.error` are exclusively used.

**Patterns:**
- Informational messages: `console.log` is used for server startup messages, connection statuses, agent activities, and message logging.
- Error messages: `console.error` is used for application errors, parsing failures, and unhandled exceptions.
- Log messages often include prefixes like `[OIS]`, `[Gateway]`, `[FATAL]` for categorization.

## Function Design

**Size:** Functions vary in size. Some utility functions like `getUser`, `saveChat`, `detectMentions` are relatively small (< 20 lines). Larger functions handle more complex logic like `wss.on('connection', ...)`, which includes message parsing and routing, or `loadMarkdownHistory` which processes files.

**Parameters:** Parameters are passed directly to functions. No apparent object destructuring for parameters in function signatures.

**Return Values:** Functions often return simple values (`true`/`false`, `null`, objects) or handle side effects.

## Module Design

**Exports:**
- CommonJS `require` and `module.exports` are used (e.g., `module.exports = { sendToOIS };`).
- Most files appear to be self-contained or import directly what they need without extensive modularization into smaller files.

**Barrel Files:**
- Not detected.

---

*Convention analysis: 2026-02-11*
