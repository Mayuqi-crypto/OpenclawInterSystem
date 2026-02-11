const WebSocket = require("ws");
const http = require("http");

const OIS_URL = process.env.OIS_URL || "ws://your-server:8800";
const AGENT_TOKEN = process.env.OIS_AGENT_TOKEN || "your-token-here";
const MY_NAME = process.env.OIS_AGENT_NAME || "Mikasa";
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || "18789");
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "your-gateway-token-here";
const CONTEXT_COUNT = parseInt(process.env.OIS_CONTEXT_COUNT || "10");

let ws, lastMessageId = 0;
let recentMessages = [];

// 防崩溃
process.on("uncaughtException", (e) => {
  console.error("[FATAL] uncaughtException:", e.message);
});
process.on("unhandledRejection", (e) => {
  console.error("[FATAL] unhandledRejection:", e);
});

function injectToSession(m) {
  const contextLines = recentMessages.slice(0, -1);
  let fullMessage = "[OIS群聊] " + m.user + ": " + m.text;
  if (contextLines.length > 0) {
    fullMessage = "[OIS群聊上下文]\n" + contextLines.join("\n") + "\n\n[触发消息] " + m.user + ": " + m.text;
  }

  const payload = JSON.stringify({
    tool: "sessions_send",
    args: { sessionKey: "agent:main:main", message: fullMessage }
  });
  const req = http.request({
    hostname: "127.0.0.1",
    port: GATEWAY_PORT,
    path: "/tools/invoke",
    method: "POST",
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + GATEWAY_TOKEN,
      "Content-Length": Buffer.byteLength(payload)
    }
  }, (res) => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      console.log("[Gateway]", res.statusCode, body.substring(0, 100));
    });
  });
  req.setTimeout(5000, () => { req.destroy(); console.error("[Gateway] 超时"); });
  req.on("error", (e) => console.error("Gateway 错误:", e.message));
  req.write(payload);
  req.end();
}

// === 远程命令处理 ===
function handleCommand(msg) {
  const { id, cmd } = msg;
  console.log(`[CMD] 收到命令: ${cmd} (id=${id})`);

  let result;
  switch (cmd) {
    case "ping":
      result = { ok: true, pong: true, time: new Date().toISOString() };
      break;
    case "status":
      result = {
        ok: true,
        agent: MY_NAME,
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
        connected: true,
        recentMessages: recentMessages.length,
        time: new Date().toISOString(),
      };
      break;
    case "restart":
      result = { ok: true, message: "Restarting in 2 seconds..." };
      ws.send(JSON.stringify({ type: "command_ack", id, result }));
      setTimeout(() => process.exit(0), 2000);
      return;
    default:
      result = { ok: false, error: `Unknown command: ${cmd}` };
  }

  ws.send(JSON.stringify({ type: "command_ack", id, result }));
}

function connect() {
  console.log("[OIS] 连接中...", new Date().toISOString());

  try {
    ws = new WebSocket(OIS_URL);
  } catch (e) {
    console.error("[OIS] 创建连接失败:", e.message);
    setTimeout(connect, 5000);
    return;
  }

  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "agent_auth", token: AGENT_TOKEN }));
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      console.error("[OIS] JSON解析失败:", e.message);
      return;
    }

    if (msg.type === "auth_ok") console.log("认证成功:", msg.user);
    if (msg.type === "history" && msg.messages && msg.messages.length) {
      lastMessageId = msg.messages[msg.messages.length - 1].id;
      recentMessages = msg.messages.slice(-CONTEXT_COUNT).map(m => m.user + ": " + m.text);
    }
    if (msg.type === "command") {
      handleCommand(msg);
    }
    if (msg.type === "message") {
      const m = msg.message;
      if (!m || m.id <= lastMessageId || m.user.includes(MY_NAME)) return;
      lastMessageId = m.id;
      console.log("[" + m.user + "]", m.text);

      recentMessages.push(m.user + ": " + m.text);
      if (recentMessages.length > CONTEXT_COUNT) recentMessages.shift();

      const mentionsLower = (m.mentions || []).map(x => x.toLowerCase());
      if (mentionsLower.includes("mikasa") || mentionsLower.includes("all")) {
        console.log(">>> 被@了! 带上下文注入");
        injectToSession(m);
      }
    }
  });

  ws.on("close", () => setTimeout(connect, 5000));
  ws.on("error", (e) => console.error(e.message));
}

console.log(`=== Mikasa OIS Monitor v7.0 ===`);
console.log("时间:", new Date().toISOString());
console.log("支持远程命令: ping, status, restart");
connect();
