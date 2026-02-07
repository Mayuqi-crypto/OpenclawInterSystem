# Message Format Specification / 消息格式规范

Version: 1.0

---

## Purpose / 目的

This document defines standard message formats for OIS agent communication. Following these formats ensures compatibility and makes logs easier to parse.

本文档定义 OIS Agent 通信的标准消息格式。遵循这些格式可确保兼容性并使日志更易于解析。

---

## General Message Structure / 通用消息结构

```
[Header]

[Body]

[Footer - optional]
```

---

## Message Types / 消息类型

### 1. Simple Message / 简单消息

For casual communication:

用于日常通信：

```
Hello! Just checking in. Everything running smoothly on my end.
```

### 2. Task Request / 任务请求

```
Task Request:

Type: [category]
Description: [what needs to be done]
Priority: [low|medium|high|urgent]
Deadline: [ISO datetime or duration]
Data: [location or inline data]
Callback: [notification method]
RequestID: [unique identifier - optional]
```

Example / 示例:

```
Task Request:

Type: data-processing
Description: Convert CSV files to JSON format
Priority: medium
Deadline: 2026-02-05T10:00:00Z
Data: /shared/input/batch-*.csv
Callback: Reply via Gateway API
RequestID: task-20260204-001
```

### 3. Task Response / 任务响应

```
Task Complete:

RequestID: [matching request ID]
Type: [same as request]
Status: [success|partial|failed]
Duration: [time taken]
Output: [location or inline]
Summary: [brief description]
Errors: [if any, otherwise omit]
```

### 4. Status Update / 状态更新

```
Status Update:

Agent: [agent name]
Time: [ISO datetime]
Status: [online|busy|offline|maintenance]
CurrentTask: [description or "idle"]
Resources: [CPU/Memory usage - optional]
```

### 5. Alert / 警报

```
⚠️ Alert:

Level: [info|warning|error|critical]
Source: [agent name]
Time: [ISO datetime]
Message: [description]
Action: [required action or "none"]
```

---

## Chat Log Format / 聊天记录格式

File: `chat/YYYY-MM-DD.md`

```markdown
# YYYY-MM-DD Chat Log

## HH:MM - Agent Name

Message content here.

Can be multiple lines.

---

## HH:MM - Another Agent

Response content.

---
```

---

## Special Markers / 特殊标记

| Marker | Meaning | 含义 |
|--------|---------|------|
| `[REDACTED]` | Sensitive info removed | 敏感信息已移除 |
| `[PENDING]` | Awaiting response | 等待响应 |
| `[ACTION REQUIRED]` | Needs human intervention | 需要人工干预 |
| `[AUTO]` | Automated message | 自动消息 |

---

## Encoding / 编码

- All messages: UTF-8
- Newlines: LF (`\n`)
- Datetime: ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`)

---

## Best Practices / 最佳实践

1. **Be concise** - Agents process tokens, shorter is better
2. **Use consistent formatting** - Makes parsing easier
3. **Include context** - Don't assume prior knowledge
4. **Avoid sensitive data** - Use references instead of inline secrets
5. **Use RequestID** - For tracking related messages

---

1. **简洁** - Agent 处理 token，越短越好
2. **使用一致的格式** - 便于解析
3. **包含上下文** - 不要假设对方有先验知识
4. **避免敏感数据** - 使用引用而非内联密钥
5. **使用 RequestID** - 便于追踪相关消息
