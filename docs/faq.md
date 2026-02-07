# FAQ - Frequently Asked Questions / 常见问题

## General / 通用

### What is OIS?

OIS (OpenclawInterSystem) is a collaboration framework for connecting multiple OpenClaw AI agents across different machines. It enables agent-to-agent communication, shared resources, and team coordination.

### OIS 是什么？

OIS（OpenclawInterSystem）是一个用于连接不同机器上多个 OpenClaw AI Agent 的协作框架。它支持 Agent 间通信、共享资源和团队协调。

---

### Why not just use Telegram/Discord groups?

Telegram bots cannot see messages from other bots - this is a platform security restriction. Discord has similar limitations. OIS uses direct Gateway API calls to bypass these restrictions.

### 为什么不直接用 Telegram/Discord 群？

Telegram Bot 看不到其他 Bot 发的消息——这是平台的安全限制。Discord 也有类似限制。OIS 使用直接的 Gateway API 调用来绕过这些限制。

---

### How many agents can I connect?

There's no hard limit. The framework scales linearly - each agent needs to know other agents' connection info. For very large deployments (10+), consider a central relay architecture.

### 可以连接多少个 Agent？

没有硬性限制。框架线性扩展——每个 Agent 需要知道其他 Agent 的连接信息。对于大规模部署（10+），考虑使用中央中继架构。

---

## Setup / 设置

### Do I need a public IP?

No. ZeroTier creates a virtual private network, so agents can communicate using private IPs even behind NAT.

### 需要公网 IP 吗？

不需要。ZeroTier 创建虚拟私有网络，所以即使在 NAT 后面，Agent 也可以使用私有 IP 通信。

---

### Can I use this without ZeroTier?

Yes. Any network that allows agents to reach each other works:
- Same LAN
- VPN (WireGuard, OpenVPN)
- Public IPs with firewall rules
- SSH tunnels

### 可以不用 ZeroTier 吗？

可以。任何能让 Agent 互相访问的网络都行：
- 同一局域网
- VPN（WireGuard、OpenVPN）
- 带防火墙规则的公网 IP
- SSH 隧道

---

### What ports need to be open?

Only the Gateway port (default 18789) needs to be accessible between agents. This should NOT be exposed to the public internet.

### 需要开放哪些端口？

只需要 Gateway 端口（默认 18789）在 Agent 之间可访问。这个端口不应该暴露到公网。

---

## Communication / 通信

### How do agents send messages?

Via HTTP POST to `/tools/invoke` endpoint:

```bash
curl -X POST http://<ip>:<port>/tools/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tool": "sessions_send", "args": {"message": "Hello!"}}'
```

### Agent 如何发送消息？

通过 HTTP POST 到 `/tools/invoke` 端点：

```bash
curl -X POST http://<ip>:<port>/tools/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tool": "sessions_send", "args": {"message": "你好！"}}'
```

---

### Is communication encrypted?

- ZeroTier: Yes, end-to-end encrypted
- Direct HTTP: No, use HTTPS or VPN for encryption
- Recommended: Always use ZeroTier or VPN

### 通信是加密的吗？

- ZeroTier：是的，端到端加密
- 直接 HTTP：不是，使用 HTTPS 或 VPN 加密
- 建议：始终使用 ZeroTier 或 VPN

---

### What if an agent is offline?

Messages sent to offline agents will fail. The sender receives an error response. Consider:
- Retry logic in your scripts
- Store-and-forward via shared storage
- Health check before sending

### 如果 Agent 离线怎么办？

发送给离线 Agent 的消息会失败。发送者会收到错误响应。考虑：
- 在脚本中加入重试逻辑
- 通过共享存储进行存储转发
- 发送前进行健康检查

---

## Security / 安全

### How do I protect my tokens?

- Never send tokens via agent messages
- Use different tokens for each agent
- Store in config files with 600 permissions
- Share only via secure channels (direct to human owner)

### 如何保护我的 token？

- 永远不要通过 Agent 消息发送 token
- 为每个 Agent 使用不同的 token
- 存储在权限为 600 的配置文件中
- 仅通过安全渠道分享（直接发给人类主人）

---

### What if a token is leaked?

1. Immediately change the token in `openclaw.json`
2. Restart the Gateway
3. Update AGENTS.md with new token
4. Notify trusted agents via secure channel

### 如果 token 泄露怎么办？

1. 立即在 `openclaw.json` 中更改 token
2. 重启 Gateway
3. 更新 AGENTS.md 中的新 token
4. 通过安全渠道通知可信 Agent

---

## Troubleshooting / 故障排除

### "Connection refused" error

- Check if target agent's Gateway is running: `openclaw status`
- Verify network: `ping <target-ip>`
- Check ZeroTier: `zerotier-cli listnetworks`

### "Connection refused" 错误

- 检查目标 Agent 的 Gateway 是否在运行：`openclaw status`
- 验证网络：`ping <target-ip>`
- 检查 ZeroTier：`zerotier-cli listnetworks`

---

### "401 Unauthorized" error

- Verify the token is correct
- Check if token was recently rotated
- Ensure no extra whitespace in token

### "401 Unauthorized" 错误

- 验证 token 是否正确
- 检查 token 是否最近轮换过
- 确保 token 中没有多余的空格

---

### Messages not being received

- Check Gateway logs
- Verify `sessionKey` is correct (usually `agent:main:main`)
- Test with a simple message first

### 消息没有被接收

- 检查 Gateway 日志
- 验证 `sessionKey` 是否正确（通常是 `agent:main:main`）
- 先用简单消息测试

---

*Still have questions? Open an issue on GitHub!*

*还有问题？在 GitHub 上开一个 issue！*
