// OIS App - Core module
const OIS = {
  token: localStorage.getItem('ois-token'),
  username: localStorage.getItem('ois-username'),
  ws: null,
  agentStatuses: {},
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function apiFetch(url, options = {}) {
  const headers = { ...options.headers, 'Authorization': 'Bearer ' + OIS.token };
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('ois-token');
    location.reload();
    return null;
  }
  return res;
}

// Login
async function login() {
  const user = document.getElementById('login-username').value.trim();
  const pass = document.getElementById('login-password').value;
  if (!user || !pass) { document.getElementById('login-error').textContent = '请填写用户名和密码'; return; }
  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });
    if (res.ok) {
      const data = await res.json();
      OIS.token = data.token; OIS.username = data.user;
      localStorage.setItem('ois-token', OIS.token);
      localStorage.setItem('ois-username', OIS.username);
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('user-display').textContent = OIS.username;
      connectWS();
      loadMembers();
    } else {
      document.getElementById('login-error').textContent = '密码错误';
    }
  } catch (e) { document.getElementById('login-error').textContent = '连接失败'; }
}

async function verifyToken() {
  try {
    const res = await fetch('/api/verify', { headers: { 'Authorization': 'Bearer ' + OIS.token } });
    if (res.ok) {
      const data = await res.json();
      OIS.username = data.user;
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('user-display').textContent = OIS.username;
      connectWS();
      loadMembers();
    } else {
      localStorage.removeItem('ois-token');
      OIS.token = null;
    }
  } catch (e) {}
}

async function loadMembers() {
  try {
    const res = await apiFetch('/api/members');
    if (res && res.ok) {
      const data = await res.json();
      const container = document.getElementById('member-buttons');
      if (container) {
        container.innerHTML = data.members.map(m => {
          const status = OIS.agentStatuses[m.name] || 'offline';
          return `<button class="mention-btn" data-name="${m.name}" onclick="toggleMention(this)"><span class="conn-status ${status}"></span>${m.display}</button>`;
        }).join('');
      }
    }
  } catch(e) {}
}

// Tab switching
function switchPanel(panelName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-panel="${panelName}"]`)?.classList.add('active');

  const panels = ['chat-panel', 'files-panel', 'editor-panel', 'health-panel', 'tasks-panel', 'memory-panel'];
  panels.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('active', p === panelName + '-panel');
  });

  if (panelName === 'files') loadFiles('');
  if (panelName === 'health') loadHealthDashboard();
  if (panelName === 'tasks') loadTasks();
  if (panelName === 'memory') loadMemoryPanel();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  if (OIS.token) verifyToken();

  document.getElementById('login-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
  });
});

function showLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('active');
}
