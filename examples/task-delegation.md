# Example: Task Delegation / 示例：任务委托

This example shows how Agent A can delegate a task to Agent B.

本示例展示 Agent A 如何将任务委托给 Agent B。

---

## Scenario / 场景

- **Agent A** (Master): 24/7 cloud server, limited compute
- **Agent B**: Powerful local workstation, 16 cores

Agent A receives a request for heavy computation and delegates it to Agent B.

- **Agent A**（Master）：24/7 云服务器，算力有限
- **Agent B**：强大的本地工作站，16 核

Agent A 收到重计算请求，委托给 Agent B 处理。

---

## Step 1: Agent A Sends Task / 步骤 1：Agent A 发送任务

```bash
curl -X POST http://10.x.x.x:18783/tools/invoke \
  -H "Authorization: Bearer <agent-b-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sessions_send",
    "args": {
      "sessionKey": "agent:main:main",
      "message": "Task Request:\n\nType: Heavy Computation\nDescription: Process 10GB dataset and generate report\nPriority: High\nDeadline: 2 hours\nCallback: Please notify me when complete via Gateway API\n\nData location: /shared/datasets/batch-001/"
    }
  }'
```

---

## Step 2: Agent B Processes / 步骤 2：Agent B 处理

Agent B receives the message, processes the task, then responds:

Agent B 收到消息，处理任务，然后响应：

```bash
curl -X POST http://10.x.x.x:18789/tools/invoke \
  -H "Authorization: Bearer <agent-a-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sessions_send",
    "args": {
      "sessionKey": "agent:main:main",
      "message": "Task Complete:\n\nType: Heavy Computation\nStatus: Success\nDuration: 45 minutes\nOutput: /shared/results/batch-001-report.pdf\n\nSummary: Processed 10GB, generated 150-page report. No errors."
    }
  }'
```

---

## Step 3: Log the Interaction / 步骤 3：记录交互

Both agents append to `chat/YYYY-MM-DD.md`:

两个 Agent 都追加到 `chat/YYYY-MM-DD.md`：

```markdown
## 14:30 - Agent A

Delegated heavy computation task to Agent B.
Dataset: batch-001 (10GB)

---

## 15:15 - Agent B

Completed batch-001 processing.
Result: /shared/results/batch-001-report.pdf

---
```

---

## Message Format Recommendations / 消息格式建议

For structured task delegation, use consistent format:

为了结构化的任务委托，使用一致的格式：

### Task Request / 任务请求

```
Task Request:

Type: [computation|file-processing|web-scraping|...]
Description: [what needs to be done]
Priority: [low|medium|high|urgent]
Deadline: [time or duration]
Data: [location or inline]
Callback: [how to report completion]
```

### Task Response / 任务响应

```
Task Complete:

Type: [same as request]
Status: [success|partial|failed]
Duration: [how long it took]
Output: [location or inline]
Summary: [brief description of results]
Errors: [if any]
```

---

## Error Handling / 错误处理

If Agent B cannot complete the task:

如果 Agent B 无法完成任务：

```bash
curl -X POST http://10.x.x.x:18789/tools/invoke \
  -H "Authorization: Bearer <agent-a-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "sessions_send",
    "args": {
      "sessionKey": "agent:main:main",
      "message": "Task Failed:\n\nType: Heavy Computation\nStatus: Failed\nReason: Out of memory at 8GB processed\nPartial output: /shared/results/batch-001-partial.csv\n\nSuggestion: Split dataset into smaller chunks"
    }
  }'
```

---

## Automation Tips / 自动化技巧

For production use, wrap API calls in scripts:

生产环境中，将 API 调用封装在脚本中：

```bash
#!/bin/bash
# delegate-task.sh

TARGET_IP="10.x.x.x"
TARGET_PORT="18783"
TARGET_TOKEN="xxx"
TASK_MSG="$1"

curl -sS -X POST "http://${TARGET_IP}:${TARGET_PORT}/tools/invoke" \
  -H "Authorization: Bearer ${TARGET_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"sessions_send\",
    \"args\": {
      \"sessionKey\": \"agent:main:main\",
      \"message\": \"${TASK_MSG}\"
    }
  }"
```

Usage / 使用：

```bash
./delegate-task.sh "Process batch-002 dataset"
```
