# Security Best Practices / 安全最佳实践

## Golden Rules / 黄金法则

1. **Never share tokens via agent channels** / 永远不要通过 Agent 通道传递 token
2. **Use private networks** / 使用私有网络
3. **Validate before trust** / 验证后再信任

---

## Token Management / Token 管理

### DO / 应该

✅ Store tokens in secure config files with restricted permissions
✅ Use different tokens for different agents
✅ Rotate tokens periodically
✅ Share tokens via secure out-of-band channels (direct message to human owner)

✅ 将 token 存储在权限受限的安全配置文件中
✅ 为不同的 Agent 使用不同的 token
✅ 定期轮换 token
✅ 通过安全的带外通道分享 token（直接发送给人类主人）

### DON'T / 不应该

❌ Send tokens via Gateway API messages
❌ Commit tokens to public repositories
❌ Use the same token across all agents
❌ Share tokens in group chats

❌ 通过 Gateway API 消息发送 token
❌ 将 token 提交到公开仓库
❌ 在所有 Agent 上使用相同的 token
❌ 在群聊中分享 token

---

## Network Security / 网络安全

### Recommended Setup / 推荐设置

```
Internet ─┬─► Firewall ─► Agent Gateway (internal only)
          │
          └─► ZeroTier Network (encrypted, private)
                    │
                    ├── Agent A
                    ├── Agent B
                    └── Agent C
```

### Configuration / 配置

```json
// openclaw.json
{
  "gateway": {
    "bind": "lan",          // Don't bind to 0.0.0.0
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "<strong-random-token>"
    }
  }
}
```

---

## New Agent Verification / 新 Agent 验证

Before adding a new agent to the network:

1. **Verify ownership** - Confirm the new agent belongs to a trusted party
2. **Test connectivity** - Send a test message and verify response
3. **Check permissions** - What should this agent be allowed to do?

在将新 Agent 添加到网络之前：

1. **验证所有权** - 确认新 Agent 属于可信任的一方
2. **测试连通性** - 发送测试消息并验证响应
3. **检查权限** - 这个 Agent 应该被允许做什么？

---

## Sensitive Information Handling / 敏感信息处理

### In Chat Logs / 在聊天记录中

```markdown
## 14:30 - Agent A

Executed backup to [REDACTED] storage.
API response: success (details in secure log)
```

### In AGENTS.md / 在 AGENTS.md 中

For public repos, use templates:
```markdown
- Token: `<configured-in-private-deployment>`
```

For private deployments, include real values.

对于公开仓库，使用模板：
```markdown
- Token: `<configured-in-private-deployment>`
```

对于私有部署，填入真实值。

---

## Incident Response / 事件响应

If a token is compromised:

1. **Immediately** rotate the affected token
2. **Notify** all agents in the network
3. **Review** logs for unauthorized access
4. **Update** AGENTS.md with new token

如果 token 泄露：

1. **立即**轮换受影响的 token
2. **通知**网络中的所有 Agent
3. **审查**日志查找未授权访问
4. **更新** AGENTS.md 中的新 token

---

## Checklist / 检查清单

- [ ] All agents use ZeroTier/VPN (not public internet)
- [ ] Gateway binds to LAN only, not 0.0.0.0
- [ ] Each agent has a unique token
- [ ] Tokens are not in any public repository
- [ ] AGENTS.md in public repo uses placeholders
- [ ] Firewall blocks external access to Gateway ports

---

- [ ] 所有 Agent 使用 ZeroTier/VPN（非公网直连）
- [ ] Gateway 仅绑定到 LAN，不是 0.0.0.0
- [ ] 每个 Agent 有唯一的 token
- [ ] Token 不在任何公开仓库中
- [ ] 公开仓库中的 AGENTS.md 使用占位符
- [ ] 防火墙阻止外部访问 Gateway 端口
