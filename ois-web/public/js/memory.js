// OIS Memory module
let memoryScope = 'team';

async function loadMemoryPanel() {
  await loadMemories();
}

function switchMemoryScope(scope) {
  memoryScope = scope;
  document.querySelectorAll('.memory-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.memory-tab[data-scope="${scope}"]`)?.classList.add('active');
  loadMemories();
}

async function loadMemories() {
  try {
    let url;
    if (memoryScope === 'team') {
      url = '/api/memory/team';
    } else {
      url = `/api/memory/agent/${encodeURIComponent(memoryScope)}`;
    }

    const search = document.getElementById('memory-search-input')?.value;
    if (search) url += `?search=${encodeURIComponent(search)}`;

    const res = await apiFetch(url);
    if (!res || !res.ok) return;
    const data = await res.json();
    const list = document.getElementById('memory-list');
    if (!list) return;

    if (data.memories.length === 0) {
      list.innerHTML = '<p style="color:#888;padding:1rem;">暂无记忆</p>';
      return;
    }

    list.innerHTML = data.memories.map(mem => `
      <div class="memory-item">
        <div class="memory-key">${escapeHtml(mem.key || mem.category || 'untitled')}</div>
        <div class="memory-content">${escapeHtml(mem.content)}</div>
        <div class="memory-meta">
          ${mem.agent !== '_team' ? 'Agent: ' + escapeHtml(mem.agent) + ' · ' : ''}
          重要度: ${mem.importance || 0.5} ·
          访问: ${mem.access_count || 0}次 ·
          更新: ${formatDate(mem.updated_at)}
          <button onclick="deleteMemoryById(${mem.id})" style="margin-left:0.5rem;background:none;border:1px solid #444;color:#888;padding:2px 6px;border-radius:3px;cursor:pointer;">删除</button>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

async function searchMemory() {
  await loadMemories();
}

async function addMemory() {
  const key = prompt('记忆 Key (如 project.status):');
  if (!key) return;
  const content = prompt('记忆内容:');
  if (!content) return;
  const category = prompt('分类 (如 fact, preference, event):', 'fact');

  try {
    let url;
    if (memoryScope === 'team') {
      url = '/api/memory/team';
    } else {
      url = `/api/memory/agent/${encodeURIComponent(memoryScope)}`;
    }

    await apiFetch(url, {
      method: 'PUT',
      body: JSON.stringify({ key, content, category })
    });
    loadMemories();
  } catch (e) { alert(`添加记忆失败: ${e.message}`); }
}

async function deleteMemoryById(id) {
  if (!confirm('确定删除此记忆?')) return;
  try {
    await apiFetch(`/api/memory/${id}`, { method: 'DELETE' });
    loadMemories();
  } catch (e) {}
}
