// OIS Health Dashboard module

async function loadHealthDashboard() {
  try {
    const res = await apiFetch('/api/agents/status');
    if (!res || !res.ok) return;
    const data = await res.json();
    const grid = document.getElementById('health-grid');
    if (!grid) return;

    if (data.agents.length === 0) {
      grid.innerHTML = '<p style="color:#888;padding:1rem;">暂无 Agent 注册</p>';
      return;
    }

    grid.innerHTML = data.agents.map(agent => {
      const status = agent.status || 'offline';
      const lastSeen = agent.last_seen ? formatDate(agent.last_seen) : '从未';
      const connectedAt = agent.connected_at ? formatDate(agent.connected_at) : '-';
      return `
        <div class="agent-card">
          <div class="status-dot ${status}"></div>
          <div class="agent-name">${escapeHtml(agent.display_name || agent.name)}</div>
          <div class="agent-meta">
            <span>状态: ${status === 'online' ? '在线' : '离线'}</span>
            <span>最后活跃: ${lastSeen}</span>
            <span>连接时间: ${connectedAt}</span>
            <span>错误次数: ${agent.error_count || 0}</span>
          </div>
          <div class="agent-actions">
            <button onclick="sendAgentCmd('${agent.name}', 'ping')">Ping</button>
            <button onclick="sendAgentCmd('${agent.name}', 'status')">状态</button>
            <button onclick="sendAgentCmd('${agent.name}', 'restart')">重启</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

async function sendAgentCmd(agentName, cmd) {
  try {
    const res = await apiFetch(`/api/agents/${encodeURIComponent(agentName)}/command`, {
      method: 'POST',
      body: JSON.stringify({ cmd })
    });
    if (!res) return;
    const data = await res.json();
    if (data.ok) {
      alert(`命令 "${cmd}" 发送成功!\n结果: ${JSON.stringify(data.result, null, 2)}`);
    } else {
      alert(`命令失败: ${data.error}`);
    }
  } catch (e) {
    alert(`发送命令失败: ${e.message}`);
  }
}
