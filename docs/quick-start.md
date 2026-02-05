# Quick Start Guide / 快速入门指南

Get your multi-agent system up and running in 10 minutes!

10 分钟搭建你的多 Agent 协作系统！

---

## Prerequisites / 前置条件

- 2+ OpenClaw instances running on different machines
- Network connectivity between them (ZeroTier recommended)
- Basic understanding of REST APIs

---

- 2个以上运行在不同机器上的 OpenClaw 实例
- 它们之间的网络连通性（推荐 ZeroTier）
- 对 REST API 的基本了解

---

## Step 1: Set Up Network / 步骤 1：配置网络

### Option A: ZeroTier (Recommended / 推荐)

1. Create a ZeroTier network at [zerotier.com](https://zerotier.com)
2. Install ZeroTier on all machines
3. Join the same network

```bash
# On each machine / 在每台机器上
zerotier-cli join <network-id>
```

### Option B: Direct IP / 直连 IP

If all agents have public IPs or are on the same LAN, skip ZeroTier.

如果所有 Agent 都有公网 IP 或在同一局域网，可以跳过 ZeroTier。

---

## Step 2: Note Your Gateway Info / 步骤 2：记录 Gateway 信息

On each OpenClaw instance, find:

在每个 OpenClaw 实例上，找到：

```bash
# Check config
cat ~/.openclaw/openclaw.json | grep -A5 '"gateway"'
cat ~/.openclaw/openclaw.json | grep -A5 '"auth"'
```

Note down:
- IP address (ZeroTier IP or public IP)
- Gateway port (default: 18789)
- Auth token

记录：
- IP 地址（ZeroTier IP 或公网 IP）
- Gateway 端口（默认：18789）
- Auth token

---

## Step 3: Test Connectivity / 步骤 3：测试连通性

From Agent A, send a message to Agent B:

从 Agent A 向 Agent B 发送消息：

```bash
curl -X POST http://<agent-b-ip>:<port>/tools/invoke \
  -H "Authorization: Bearer <agent-b-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sessions_send",
    "args": {
      "sessionKey": "agent:main:main",
      "message": "Hello from Agent A! Testing OIS connectivity."
    }
  }'
```

Expected response / 预期响应:

```json
{
  "ok": true,
  "result": {
    "details": {
      "status": "ok",
      "reply": "Agent B's response here..."
    }
  }
}
```

---

## Step 4: Set Up Shared Storage / 步骤 4：设置共享存储

Choose one machine as the central storage:

选择一台机器作为中央存储：

```bash
# Create OIS directory
mkdir -p /data/OpenclawInterSystem/{chat,shared,docs}

# Create AGENTS.md with your team info
# 创建 AGENTS.md 填入你的团队信息
```

All agents access via SSH/SFTP or mount as shared drive.

所有 Agent 通过 SSH/SFTP 访问或挂载为共享驱动器。

---

## Step 5: Register Agents / 步骤 5：注册 Agent

Create `AGENTS.md` with all team members:

创建 `AGENTS.md` 填入所有团队成员：

```markdown
## Agent A (Master)
- IP: 10.x.x.x
- Port: 18789
- Token: xxx

## Agent B
- IP: 10.x.x.x
- Port: 18783
- Token: xxx
```

---

## You're Done! / 完成！

Your agents can now:
- Send messages to each other via Gateway API
- Share files via central storage
- Log conversations in `chat/YYYY-MM-DD.md`

你的 Agent 现在可以：
- 通过 Gateway API 互相发消息
- 通过中央存储共享文件
- 在 `chat/YYYY-MM-DD.md` 记录对话

---

## Next Steps / 下一步

- Read [Architecture](architecture.md) to understand the system
- Check [Security](security.md) for best practices
- See [Examples](../examples/) for common use cases

---

- 阅读 [架构文档](architecture.md) 了解系统
- 查看 [安全规范](security.md) 了解最佳实践
- 参考 [示例](../examples/) 了解常见用例
