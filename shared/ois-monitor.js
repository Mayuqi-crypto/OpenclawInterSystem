const WebSocket = require("ws");
const http = require("http");

const OIS_URL = "ws://fr.shielber.uk:8800";
const AGENT_TOKEN = "e2d9aa3ac991ca831ed6558f4c72dfc7";
const GATEWAY_PORT = 18783;
const GATEWAY_AUTH = "b34400ee456aeefcad065d36fa367c94fe8874494a492ce8";
const CONTEXT_LINES = 10;

let ws;
let authenticated = false;
let recentMessages = [];

// 保活：防止 Node 进程退出
setInterval(() => {}, 60000);

// 捕获未处理异常，防止崩溃
process.on("uncaughtException", (e) => {
  console.error("[FATAL] uncaughtException:", e.message);
});
process.on("unhandledRejection", (e) => {
  console.error("[FATAL] unhandledRejection:", e);
});

function wakeGateway(message) {
  const data = JSON.stringify({
    tool: "cron",
    args: {
      action: "wake",
      text: `[OIS群聊] ${message}`,
      mode: "now"
    }
  });
  
  const options = {
    hostname: "127.0.0.1",
    port: GATEWAY_PORT,
    path: "/tools/invoke",
    method: "POST",
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
      "Authorization": `Bearer ${GATEWAY_AUTH}`
    }
  };
  
  const req = http.request(options, (res) => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      console.log("[Gateway] wake:", res.statusCode, body.substring(0, 100));
    });
  });
  req.setTimeout(5000, () => { req.destroy(); console.error("[Gateway] 超时"); });
  req.on("error", (e) => console.error("[Gateway] 错误:", e.message));
  req.write(data);
  req.end();
}

function sendToOIS(text) {
  if (ws && ws.readyState === WebSocket.OPEN && authenticated) {
    ws.send(JSON.stringify({ type: "chat", text }));
    console.log("[OIS] 已发送:", text.substring(0, 50));
    return true;
  }
  console.log("[OIS] 发送失败: 未连接或未认证");
  return false;
}

function checkMention(msg) {
  if (!msg.mentions || !Array.isArray(msg.mentions)) return false;
  return msg.mentions.some(m => {
    const lower = String(m).toLowerCase();
    return lower === "aria" || lower === "all";
  });
}

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
      const recent = msgs.slice(-CONTEXT_LINES);
      recent.forEach(m => {
        addToRecent(m.user || "?", m.text || "", m.attachments || []);
      });
      console.log("[OIS] 历史消息:", msgs.length, "| 缓存上下文:", recentMessages.length);
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
      
      if (user.toLowerCase().includes("aria")) return;
      
      if (checkMention(m)) {
        console.log(">>> 收到提及! mentions:", m.mentions);
        let wakeText = `${user} 说: ${text}`;
        if (attachments.length) {
          const urls = attachments.map(a => a.url || a.filename || "文件").join(", ");
          wakeText += `\n附件: ${urls}`;
        }
        wakeText += formatContext();
        wakeGateway(wakeText);
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

console.log("=== ARIA OIS Monitor v6.1 ===");
console.log("时间:", new Date().toISOString());
console.log("Gateway:", GATEWAY_PORT, "(wake + 认证 + 上下文)");
console.log("OIS:", OIS_URL);
console.log("上下文条数:", CONTEXT_LINES);
connect();
