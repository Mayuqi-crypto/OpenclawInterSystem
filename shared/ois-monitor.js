#!/usr/bin/env node
/**
 * OIS Monitor v7.1 — 通用 Agent 客户端
 *
 * 功能：
 *   1. 连接 OIS 群聊服务器（WebSocket）
 *   2. 监听 @提及，被 @ 时通知本地 Gateway
 *   3. 提供 HTTP 回复接口，让 Gateway 能发消息到群聊
 *   4. 提供自注入接口，把消息注入到 Agent 自己的 session
 *   5. 接收服务端远程命令（ping、status、restart）
 *   6. 缓存最近消息作为上下文，@ 触发时带上下文一起发给 Gateway
 *
 * 环境变量：
 *   OIS_URL           — OIS 群聊服务器地址（如 ws://fr.shielber.uk:8800）
 *   OIS_AGENT_TOKEN   — Agent 认证令牌（在 OIS 服务端 .env 中配置）
 *   OIS_AGENT_NAME    — Agent 名称，用于 @提及检测（如 ARIA、Mikasa、HKH）
 *   GATEWAY_PORT      — 本地 Gateway API 端口（如 18783）
 *   GATEWAY_HOST      — Gateway 主机地址（默认 127.0.0.1）
 *   GATEWAY_TOKEN     — Gateway 认证令牌
 *   OIS_GATEWAY_MODE  — Gateway 通知模式：
 *                        "wake"   — 用 cron wake 唤醒 Agent（ARIA 用）
 *                        "inject" — 用 sessions_send 注入到 agent:main:main（Mikasa 用）
 *                        "webchat"— 用 sessions_send 注入到 agent:main:webchat（scripts 版用）
 *   OIS_CONTEXT_COUNT — 上下文消息条数（默认 10）
 *   OIS_REPLY_PORT    — HTTP 回复接口端口（默认 18790，设为 0 禁用）
 */

const WebSocket = require("ws");
const http = require("http");

// ========== 配置：全部从环境变量读取 ==========

const OIS_URL = process.env.OIS_URL || "ws://your-server:8800";
const AGENT_TOKEN = process.env.OIS_AGENT_TOKEN || "your-token-here";
const MY_NAME = process.env.OIS_AGENT_NAME || "Agent";
const GATEWAY_HOST = process.env.GATEWAY_HOST || "127.0.0.1";
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || "18783");
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "your-gateway-token-here";
const GATEWAY_MODE = process.env.OIS_GATEWAY_MODE || "wake";
const CONTEXT_LINES = parseInt(process.env.OIS_CONTEXT_COUNT || "10");
const REPLY_PORT = parseInt(process.env.OIS_REPLY_PORT || "18790");

// ========== 全局状态 ==========

let ws;                         // WebSocket 连接实例
let authenticated = false;      // 是否已通过认证
let recentMessages = [];        // 最近消息缓存（用于构建上下文）
const MAX_RECENT = 30;          // 最大缓存消息数

// 保活定时器：防止 Node.js 进程因无活动退出
setInterval(() => {}, 60000);

// 全局异常捕获：防止未处理的异常导致进程崩溃
process.on("uncaughtException", (e) => {
  console.error("[FATAL] 未捕获异常:", e.message);
});
process.on("unhandledRejection", (e) => {
  console.error("[FATAL] 未处理的 Promise 拒绝:", e);
});

// ========== HTTP 回复接口 ==========
// 作用：让 Gateway（或其他本地进程）能通过 HTTP 发消息到 OIS 群聊
// 这样 Agent 处理完任务后，可以把结果发回群聊

if (REPLY_PORT > 0) {
  const replyServer = http.createServer((req, res) => {
    // POST /send — 发送消息到 OIS 群聊
    if (req.method === "POST" && req.url === "/send") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const { text } = JSON.parse(body);
          if (!text) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "缺少 text 字段" }));
            return;
          }
          // 检查 WebSocket 是否连接
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "chat", text }));
            console.log("[回复] 已发送到群聊:", text.substring(0, 80));
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
          } else {
            console.error("[回复] WebSocket 未连接，无法发送");
            res.writeHead(503);
            res.end(JSON.stringify({ error: "WebSocket 未连接" }));
          }
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
    // POST /send_to_user — 把消息注入到 Agent 自己的 session（模拟用户输入）
    else if (req.method === "POST" && req.url === "/send_to_user") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const { text } = JSON.parse(body);
          if (!text) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "缺少 text 字段" }));
            return;
          }
          // 通过 Gateway API 注入消息到 Agent 的主 session
          callGateway("sessions_send", { sessionKey: "agent:main:main", message: text });
          console.log("[自注入] 消息已注入到主 session:", text.substring(0, 80));
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
    else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  replyServer.listen(REPLY_PORT, "127.0.0.1", () => {
    console.log(`[回复接口] http://127.0.0.1:${REPLY_PORT}/send — 发消息到群聊`);
    console.log(`[回复接口] http://127.0.0.1:${REPLY_PORT}/send_to_user — 注入到 Agent session`);
  });
}

// ========== Gateway 通信 ==========

/**
 * 调用本地 Gateway API
 * @param {string} tool — Gateway 工具名（如 "cron"、"sessions_send"）
 * @param {object} args — 工具参数
 */
function callGateway(tool, args) {
  const payload = JSON.stringify({ tool, args });

  const req = http.request({
    hostname: GATEWAY_HOST,
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
  req.setTimeout(5000, () => { req.destroy(); console.error("[Gateway] 请求超时"); });
  req.on("error", (e) => console.error("[Gateway] 错误:", e.message));
  req.write(payload);
  req.end();
}

/**
 * 通知 Gateway 有人 @ 了当前 Agent
 * 根据 OIS_GATEWAY_MODE 选择不同的通知方式：
 *   - "wake"    → 用 cron wake 唤醒 Agent
 *   - "inject"  → 注入到 agent:main:main
 *   - "webchat" → 注入到 agent:main:webchat
 */
function notifyGateway(message) {
  if (GATEWAY_MODE === "inject") {
    callGateway("sessions_send", { sessionKey: "agent:main:main", message });
  } else if (GATEWAY_MODE === "webchat") {
    callGateway("sessions_send", { sessionKey: "agent:main:webchat", message });
  } else {
    // 默认 "wake" 模式
    callGateway("cron", { action: "wake", text: message, mode: "now" });
  }
}

// ========== 发消息到 OIS 群聊 ==========

/**
 * 通过 WebSocket 发送消息到 OIS 群聊
 * @param {string} text — 消息文本
 * @returns {boolean} 是否发送成功
 */
function sendToOIS(text) {
  if (ws && ws.readyState === WebSocket.OPEN && authenticated) {
    ws.send(JSON.stringify({ type: "chat", text }));
    console.log("[OIS] 已发送:", text.substring(0, 50));
    return true;
  }
  console.log("[OIS] 发送失败: 未连接或未认证");
  return false;
}

// ========== @提及检测 ==========

/**
 * 检查消息是否 @ 了当前 Agent
 * 匹配规则：mentions 数组中包含 Agent 名称或 "all"
 */
function checkMention(msg) {
  if (!msg.mentions || !Array.isArray(msg.mentions)) return false;
  const myName = MY_NAME.toLowerCase();
  return msg.mentions.some(m => {
    const lower = String(m).toLowerCase();
    return lower === myName || lower === "all";
  });
}

// ========== 上下文管理 ==========

/**
 * 把消息加入最近消息缓存
 * 超过上限自动丢弃最旧的
 */
function addToRecent(user, text, time, attachments) {
  recentMessages.push({ user, text: text.substring(0, 200), time, attachments });
  if (recentMessages.length > MAX_RECENT) {
    recentMessages = recentMessages.slice(-MAX_RECENT);
  }
}

/**
 * 构建上下文字符串
 * 格式：带时间戳的最近 N 条消息，用于注入时提供背景信息
 */
function formatContext() {
  if (recentMessages.length === 0) return "";

  const lines = recentMessages.slice(-CONTEXT_LINES).map(m => {
    // 格式化时间为 HH:MM
    let timeStr = "";
    if (m.time) {
      try {
        timeStr = new Date(m.time).toLocaleTimeString("zh-CN", {
          hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai"
        });
      } catch (e) { timeStr = ""; }
    }
    let line = timeStr ? `[${timeStr}] ${m.user}: ${m.text}` : `[${m.user}] ${m.text}`;
    if (m.attachments && m.attachments.length) {
      line += ` [附件x${m.attachments.length}]`;
    }
    return line;
  });

  return "\n--- 最近群聊上下文 ---\n" + lines.join("\n") + "\n--- 上下文结束 ---";
}

// ========== 远程命令处理 ==========
// OIS 服务端可以通过 WebSocket 发送 command 消息给 Agent
// Agent 收到后执行对应操作，并回复 command_ack

function handleCommand(msg) {
  const { id, cmd } = msg;
  console.log(`[远程命令] 收到: ${cmd} (id=${id})`);

  let result;
  switch (cmd) {
    case "ping":
      // 连通性测试，直接返回 pong
      result = { ok: true, pong: true, time: new Date().toISOString() };
      break;

    case "status":
      // 返回当前 Agent 的运行状态
      result = {
        ok: true,
        agent: MY_NAME,
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
        connected: authenticated,
        recentMessages: recentMessages.length,
        gatewayMode: GATEWAY_MODE,
        gatewayPort: GATEWAY_PORT,
        replyPort: REPLY_PORT,
        time: new Date().toISOString(),
      };
      break;

    case "restart":
      // 重启 Agent monitor 进程
      // 先发回确认消息，再退出（systemd/PM2 会自动重启）
      result = { ok: true, message: "2 秒后重启..." };
      ws.send(JSON.stringify({ type: "command_ack", id, result }));
      setTimeout(() => process.exit(0), 2000);
      return; // 注意：这里直接 return，不再发 ack（上面已发）

    default:
      result = { ok: false, error: `未知命令: ${cmd}` };
  }

  // 回复命令执行结果
  ws.send(JSON.stringify({ type: "command_ack", id, result }));
}

// ========== WebSocket 连接 ==========

function connect() {
  console.log("[OIS] 连接中...", new Date().toISOString());

  try {
    ws = new WebSocket(OIS_URL);
  } catch (e) {
    console.error("[OIS] 创建连接失败:", e.message);
    setTimeout(connect, 5000);
    return;
  }

  // 连接成功后发送认证
  ws.on("open", () => {
    console.log("[OIS] 已连接");
    ws.send(JSON.stringify({ type: "agent_auth", token: AGENT_TOKEN }));
  });

  // 处理收到的消息
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      console.error("[OIS] JSON 解析失败:", e.message);
      return;
    }

    // — 认证成功
    if (msg.type === "auth_ok") {
      authenticated = true;
      console.log("[OIS] 认证成功:", msg.user);
    }
    // — 认证失败
    else if (msg.type === "auth_fail") {
      console.error("[OIS] 认证失败! 请检查 OIS_AGENT_TOKEN");
      authenticated = false;
    }
    // — 历史消息（连接后服务端自动发送最近的聊天记录）
    else if (msg.type === "history") {
      const msgs = msg.messages || [];
      msgs.slice(-MAX_RECENT).forEach(m => {
        addToRecent(m.user || "?", m.text || "", m.time, m.attachments || []);
      });
      console.log("[OIS] 历史消息:", msgs.length, "条 | 缓存:", recentMessages.length, "条");
    }
    // — 远程命令（从 OIS 服务端 Web 面板发来的）
    else if (msg.type === "command") {
      handleCommand(msg);
    }
    // — 新消息
    else if (msg.type === "message") {
      const m = msg.message;
      if (!m) return;

      const user = m.user || "?";
      const text = m.text || "";
      const attachments = m.attachments || [];

      // 打印消息日志
      let logLine = `[${user}] ${text.substring(0, 80)}`;
      if (attachments.length) logLine += ` [附件x${attachments.length}]`;
      console.log(logLine);

      // 缓存到最近消息
      addToRecent(user, text, m.time, attachments);

      // 忽略自己发的消息（防止循环）
      if (user.toLowerCase().includes(MY_NAME.toLowerCase())) return;

      // 检查是否被 @ 了
      if (checkMention(m)) {
        console.log(">>> 被 @ 了! mentions:", m.mentions);

        // 构建通知文本：触发消息 + 上下文
        let wakeText = `[OIS群聊] ${user} 说: ${text}`;
        if (attachments.length) {
          const urls = attachments.map(a => a.url || a.filename || "文件").join(", ");
          wakeText += `\n附件: ${urls}`;
        }
        wakeText += formatContext();

        // 发送给 Gateway
        notifyGateway(wakeText);
      }
    }
  });

  // 响应服务端的 ping（保持连接活跃）
  ws.on("ping", () => {});

  // 断线自动重连（5 秒后）
  ws.on("close", (code) => {
    authenticated = false;
    console.log(`[OIS] 断开 (code=${code}), 5 秒后重连...`);
    setTimeout(connect, 5000);
  });

  // 连接错误
  ws.on("error", (e) => {
    console.error("[OIS] 连接错误:", e.message);
  });
}

// ========== 导出（供其他模块调用） ==========

module.exports = { sendToOIS };

// ========== 启动 ==========

console.log("=== OIS Monitor v7.1 ===");
console.log(`Agent:    ${MY_NAME}`);
console.log(`OIS:      ${OIS_URL}`);
console.log(`Gateway:  ${GATEWAY_HOST}:${GATEWAY_PORT} (模式: ${GATEWAY_MODE})`);
console.log(`上下文:   ${CONTEXT_LINES} 条`);
console.log(`回复接口: ${REPLY_PORT > 0 ? "127.0.0.1:" + REPLY_PORT : "禁用"}`);
console.log(`远程命令: ping, status, restart`);
connect();
