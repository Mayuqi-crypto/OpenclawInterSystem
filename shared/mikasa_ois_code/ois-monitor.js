const WebSocket = require("ws");
const http = require("http");

const OIS_URL = "ws://fr.shielber.uk:8800";
const AGENT_TOKEN = "12a5f399bcc3032d556e3850dab2ada8";
const MY_NAME = "Mikasa 🌸";
const GATEWAY_PORT = 18789;
const GATEWAY_TOKEN = "b10134c8c209d01607fb23cf0138dd125ecee44e980d0137";
const CONTEXT_COUNT = 10; // 被@时带上最近N条上下文

let ws, lastMessageId = 0;
let recentMessages = []; // 缓存最近消息

function connect() {
  console.log("连接 OIS...");
  ws = new WebSocket(OIS_URL);
  
  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "agent_auth", token: AGENT_TOKEN }));
  });
  
  ws.on("message", (data) => {
    const msg = JSON.parse(data);
    if (msg.type === "auth_ok") console.log("认证成功:", msg.user);
    if (msg.type === "history" && msg.messages.length) {
      lastMessageId = msg.messages[msg.messages.length-1].id;
      // 缓存历史消息的最后N条作为初始上下文
      recentMessages = msg.messages.slice(-CONTEXT_COUNT).map(m => m.user + ": " + m.text);
    }
    if (msg.type === "message") {
      const m = msg.message;
      if (m.id <= lastMessageId || m.user.includes(MY_NAME)) return;
      lastMessageId = m.id;
      console.log("[" + m.user + "]", m.text);
      
      // 缓存到最近消息
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

function injectToSession(m) {
  // 构建带上下文的消息
  const contextLines = recentMessages.slice(0, -1); // 排除当前这条（已经在触发消息里）
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
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + GATEWAY_TOKEN,
      "Content-Length": Buffer.byteLength(payload)
    }
  });
  req.on("error", (e) => console.error("Gateway 错误:", e.message));
  req.write(payload);
  req.end();
}

connect();
console.log("OIS Monitor 运行中...");
