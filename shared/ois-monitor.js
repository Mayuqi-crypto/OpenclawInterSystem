const WebSocket = require("ws");
const http = require("http");

// === 配置（全部从环境变量读取） ===
const OIS_URL = process.env.OIS_URL || "ws://your-server:8800";
const AGENT_TOKEN = process.env.OIS_AGENT_TOKEN || "your-token-here";
const MY_NAME = process.env.OIS_AGENT_NAME || "Agent";
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || "18783");
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "your-gateway-token-here";
const CONTEXT_LINES = parseInt(process.env.OIS_CONTEXT_COUNT || "10");
// Gateway 模式: "wake" (cron wake) 或 "inject" (sessions_send)
const GATEWAY_MODE = process.env.OIS_GATEWAY_MODE || "wake";

let ws;
let authenticated = false;
let recentMessages = [];

// 保活
setInterval(() => {}, 60000);

// 防崩溃
process.on("uncaughtException", (e) => {
  console.error("[FATAL] uncaughtException:", e.message);
});
process.on("unhandledRejection", (e) => {
  console.error("[FATAL] unhandledRejection:", e);
});

// === Gateway 通知 ===
function notifyGateway(message) {
  let payload;

  if (GATEWAY_MODE === "inject") {
    payload = JSON.stringify({
      tool: "sessions_send",
      args: { sessionKey: "agent:main:main", message }
    });
  } else {
    payload = JSON.stringify({
      tool: "cron",
      args: { action: "wake", text: message, mode: "now" }
    });
  }

  const req = http.request({
    hostname: "127.0.0.1",
    port: GATEWAY_PORT,
    path: "/tools/invoke",
    method: "POST",
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "Authorization": `Bearer ${GATEWAY_TOKEN}`
    }
  }, (res) => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      console.log("[Gateway]", res.statusCode, body.substring(0, 100));
    });
  });
  req.setTimeout(5000, () => { req.destroy(); console.error("[Gateway] 超时"); });
  req.on("error", (e) => console.error("[Gateway] 错误:", e.message));
  req.write(payload);
  req.end();
}

// === 发消息到 OIS ===
function sendToOIS(text) {
  if (ws && ws.readyState === WebSocket.OPEN && authenticated) {
    ws.send(JSON.stringify({ type: "chat", text }));
    console.log("[OIS] 已发送:", text.substring(0, 50));
    return true;
  }
  console.log("[OIS] 发送失败: 未连接或未认证");
  return false;
}

// === 提及检测 ===
function checkMention(msg) {
  if (!msg.mentions || !Array.isArray(msg.mentions)) return false;
  const myName = MY_NAME.toLowerCase();
  return msg.mentions.some(m => {
    const lower = String(m).toLowerCase();
    return lower === myName || lower === "all";
  });
}

// === 上下文管理 ===
function formatContext() {
  if (recentMessages.length === 0) return "";
  const lines = recentMessages.map(m => {
    let line = `[${m.user}] ${m.text}`;
    if (m.attachments && m.attachments.length) {
      line += ` [附件x${m.attachments.length}]`;
    }
    return line;
  });
  return "\n--- 最近群聊上下文 ---\n" + lines.join("\n") + "\n--- 上下文结束 ---";
}

function addToRecent(user, text, attachments) {
  recentMessages.push({ user, text: text.substring(0, 200), attachments });
  if (recentMessages.length > CONTEXT_LINES) {
    recentMessages = recentMessages.slice(-CONTEXT_LINES);
  }
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
        connected: authenticated,
        recentMessages: recentMessages.length,
        gatewayMode: GATEWAY_MODE,
        gatewayPort: GATEWAY_PORT,
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

// === WebSocket 连接 ===
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
    console.log("[OIS] 已连接");
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

    if (msg.type === "auth_ok") {
      authenticated = true;
      console.log("[OIS] 认证成功:", msg.user);
    }
    else if (msg.type === "auth_fail") {
      console.error("[OIS] 认证失败!");
      authenticated = false;
    }
    else if (msg.type === "history") {
      const msgs = msg.messages || [];
      msgs.slice(-CONTEXT_LINES).forEach(m => {
        addToRecent(m.user || "?", m.text || "", m.attachments || []);
      });
      console.log("[OIS] 历史消息:", msgs.length, "| 缓存:", recentMessages.length);
    }
    else if (msg.type === "command") {
      handleCommand(msg);
    }
    else if (msg.type === "message") {
      const m = msg.message;
      if (!m) return;

      const user = m.user || "?";
      const text = m.text || "";
      const attachments = m.attachments || [];

      let logLine = `[${user}] ${text.substring(0, 80)}`;
      if (attachments.length) logLine += ` [附件x${attachments.length}]`;
      console.log(logLine);

      addToRecent(user, text, attachments);

      // 忽略自己发的消息
      if (user.toLowerCase().includes(MY_NAME.toLowerCase())) return;

      if (checkMention(m)) {
        console.log(">>> 收到提及! mentions:", m.mentions);
        let wakeText = `[OIS群聊] ${user} 说: ${text}`;
        if (attachments.length) {
          const urls = attachments.map(a => a.url || a.filename || "文件").join(", ");
          wakeText += `\n附件: ${urls}`;
        }
        wakeText += formatContext();
        notifyGateway(wakeText);
      }
    }
  });

  ws.on("ping", () => {});

  ws.on("close", (code) => {
    authenticated = false;
    console.log(`[OIS] 断开 (code=${code}), 5秒后重连...`);
    setTimeout(connect, 5000);
  });

  ws.on("error", (e) => {
    console.error("[OIS] 错误:", e.message);
  });
}

module.exports = { sendToOIS };

console.log(`=== OIS Monitor v7.0 ===`);
console.log(`Agent: ${MY_NAME}`);
console.log(`OIS: ${OIS_URL}`);
console.log(`Gateway: 127.0.0.1:${GATEWAY_PORT} (${GATEWAY_MODE})`);
console.log(`上下文: ${CONTEXT_LINES} 条`);
console.log(`命令: ping, status, restart`);
connect();
