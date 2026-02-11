// OIS 健康监控面板模块

// 加载 Agent 健康状态仪表盘
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
      // agent.name 是纯 ASCII id（如 "ARIA"），安全用于 URL 和 HTML 属性
      // agent.display_name 是带 emoji 的展示名（如 "ARIA ⚔️"），仅用于显示
      const safeId = escapeHtml(agent.name);
      const displayName = escapeHtml(agent.display_name || agent.name);
      return `
        <div class="agent-card">
          <div class="status-dot ${status}"></div>
          <div class="agent-name">${displayName}</div>
          <div class="agent-meta">
            <span>状态: ${status === 'online' ? '在线' : '离线'}</span>
            <span>最后活跃: ${lastSeen}</span>
            <span>连接时间: ${connectedAt}</span>
            <span>错误次数: ${agent.error_count || 0}</span>
          </div>
          <div class="agent-actions">
            <button onclick="sendAgentCmd('${safeId}', 'ping')">Ping</button>
            <button onclick="sendAgentCmd('${safeId}', 'status')">状态</button>
            <button onclick="sendAgentCmd('${safeId}', 'restart')">重启</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

// 向指定 Agent 发送远程命令
// agentId 是纯 ASCII id（如 "ARIA"），不含 emoji，安全用于 URL
async function sendAgentCmd(agentId, cmd) {
  try {
    const res = await apiFetch(`/api/agents/${encodeURIComponent(agentId)}/command`, {
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
