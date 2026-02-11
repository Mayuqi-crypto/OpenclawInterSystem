// OIS Tasks module

async function loadTasks() {
  try {
    const res = await apiFetch('/api/tasks');
    if (!res || !res.ok) return;
    const data = await res.json();
    const list = document.getElementById('task-list');
    if (!list) return;

    if (data.tasks.length === 0) {
      list.innerHTML = '<p style="color:#888;padding:1rem;">暂无任务</p>';
      return;
    }

    list.innerHTML = data.tasks.map(task => {
      const statusClass = task.status || 'pending';
      const deadline = task.deadline ? formatDate(task.deadline) : '-';
      return `
        <div class="task-item">
          <div class="task-status ${statusClass}"></div>
          <div class="task-info">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
              指派: ${escapeHtml(task.assignee || '未指派')} ·
              优先级: ${task.priority} ·
              截止: ${deadline} ·
              跟进: ${task.follow_up_count || 0}次
            </div>
          </div>
          <div class="task-actions">
            ${task.status !== 'completed' ? `<button onclick="updateTaskStatus(${task.id}, 'completed')">完成</button>` : ''}
            ${task.status === 'pending' ? `<button onclick="updateTaskStatus(${task.id}, 'in_progress')">开始</button>` : ''}
            <button onclick="deleteTaskById(${task.id})">删除</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

function showCreateTask() {
  document.getElementById('task-modal').classList.add('active');
}

function hideCreateTask() {
  document.getElementById('task-modal').classList.remove('active');
}

async function createTask() {
  const title = document.getElementById('task-title').value.trim();
  const assignee = document.getElementById('task-assignee').value.trim();
  const priority = document.getElementById('task-priority').value;
  const deadline = document.getElementById('task-deadline').value;

  if (!title) { alert('请输入任务标题'); return; }

  try {
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        assignee: assignee || null,
        priority,
        deadline: deadline || null,
        follow_up_interval: 3600000,
      })
    });
    if (res && res.ok) {
      hideCreateTask();
      document.getElementById('task-title').value = '';
      document.getElementById('task-assignee').value = '';
      document.getElementById('task-deadline').value = '';
      loadTasks();
    }
  } catch (e) { alert(`创建任务失败: ${e.message}`); }
}

async function updateTaskStatus(id, status) {
  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    loadTasks();
  } catch (e) {}
}

async function deleteTaskById(id) {
  if (!confirm('确定删除此任务?')) return;
  try {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
  } catch (e) {}
}
