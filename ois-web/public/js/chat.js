// OIS Chat module
let selectedMentions = new Set();
let pendingFile = null;

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  OIS.ws = new WebSocket(`${protocol}//${location.host}`);

  OIS.ws.onopen = () => {
    OIS.ws.send(JSON.stringify({ type: 'auth', token: OIS.token }));
    updateConnStatus('online');
  };

  OIS.ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'history') {
      document.getElementById('messages').innerHTML = '';
      data.messages.forEach(addMessage);
    } else if (data.type === 'message') {
      addMessage(data.message);
    } else if (data.type === 'auth_fail') {
      localStorage.removeItem('ois-token');
      location.reload();
    } else if (data.type === 'agent_statuses') {
      data.agents.forEach(a => { OIS.agentStatuses[a.name] = a.status; });
      loadMembers();
    } else if (data.type === 'agent_status') {
      OIS.agentStatuses[data.agent] = data.status;
      loadMembers();
      // Update health panel if visible
      if (document.getElementById('health-panel')?.classList.contains('active')) {
        loadHealthDashboard();
      }
    }
  };

  OIS.ws.onclose = () => {
    updateConnStatus('connecting');
    setTimeout(connectWS, 3000);
  };

  OIS.ws.onerror = () => {
    updateConnStatus('offline');
  };
}

function updateConnStatus(status) {
  const el = document.getElementById('conn-indicator');
  if (el) {
    el.className = 'conn-status ' + status;
    el.title = status === 'online' ? '已连接' : status === 'connecting' ? '重连中...' : '已断开';
  }
}

function addMessage(msg) {
  const el = document.createElement('div');
  el.className = 'msg' + (msg.fromArchive ? ' archive' : '');

  const isAgentMessage = (user) => {
    return user.includes('\u{1F431}') || user.includes('\u{2694}\uFE0F') || user.includes('\u{1F338}') || user.includes('\u{1F98A}') || user.includes('\u{2728}');
  };
  if (isAgentMessage(msg.user)) el.classList.add('agent');

  const time = new Date(msg.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  let textHtml = escapeHtml(msg.text);
  textHtml = textHtml.replace(/@(\w+|所有人)/gi, '<span style="background:#e94560;padding:0 4px;border-radius:3px;color:white">@$1</span>');

  let attachHtml = '';
  if (msg.attachments && msg.attachments.length > 0) {
    msg.attachments.forEach(att => {
      const type = att.type || att.mimeType || '';
      if (type.startsWith('image/')) {
        attachHtml += `<div class="attachment"><img src="${att.url}" alt="${escapeHtml(att.name || att.originalName || '')}" onclick="showLightbox('${att.url}')"></div>`;
      } else {
        const name = att.name || att.originalName || 'file';
        const sizeStr = att.size > 1024*1024 ? (att.size/1024/1024).toFixed(1)+'MB' : (att.size/1024).toFixed(1)+'KB';
        attachHtml += `<div class="attachment"><a href="${att.url}" target="_blank">\u{1F4CE} ${escapeHtml(name)} (${sizeStr})</a></div>`;
      }
    });
  }

  el.innerHTML = `<div class="meta"><span class="user">${escapeHtml(msg.user)}</span> \u00B7 ${time}</div><div class="text">${textHtml}</div>${attachHtml}`;
  document.getElementById('messages').appendChild(el);
  document.getElementById('messages').scrollTop = 999999;
}

// Mentions
function toggleMention(btn) {
  const name = btn.dataset.name;
  if (selectedMentions.has(name)) {
    selectedMentions.delete(name);
    btn.classList.remove('active');
  } else {
    selectedMentions.add(name);
    btn.classList.add('active');
  }
  const allBtn = document.querySelector('.all-btn');
  if (selectedMentions.has('all') && name !== 'all') {
    selectedMentions.delete('all');
    if (allBtn) allBtn.classList.remove('active');
  }
}

function toggleMentionAll(btn) {
  if (selectedMentions.has('all')) {
    selectedMentions.clear();
    document.querySelectorAll('.mention-btn').forEach(b => b.classList.remove('active'));
  } else {
    selectedMentions.clear();
    selectedMentions.add('all');
    document.querySelectorAll('.mention-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

// File upload in chat
function onFileSelected(input) {
  if (input.files.length > 0) {
    pendingFile = input.files[0];
    document.getElementById('preview-name').textContent = `\u{1F4CE} ${pendingFile.name} (${(pendingFile.size/1024).toFixed(1)}KB)`;
    document.getElementById('file-preview').classList.add('active');
  }
}

function clearFile() {
  pendingFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('file-preview').classList.remove('active');
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + OIS.token },
    body: formData
  });
  if (res.ok) {
    const data = await res.json();
    return data.file;
  }
  return null;
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  let text = input.value.trim();

  if (!text && !pendingFile) return;
  if (!OIS.ws || OIS.ws.readyState !== WebSocket.OPEN) return;

  let mentionPrefix = '';
  if (selectedMentions.size > 0) {
    if (selectedMentions.has('all')) {
      mentionPrefix = '@all ';
    } else {
      mentionPrefix = Array.from(selectedMentions).map(n => '@' + n).join(' ') + ' ';
    }
  }
  text = mentionPrefix + text;

  let attachments = undefined;
  if (pendingFile) {
    const fileInfo = await uploadFile(pendingFile);
    if (fileInfo) {
      attachments = [fileInfo];
      if (!text.trim() || text.trim() === mentionPrefix.trim()) {
        text = (mentionPrefix + '\u53D1\u9001\u4E86\u6587\u4EF6: ' + (fileInfo.name || fileInfo.originalName)).trim();
      }
    }
    clearFile();
  }

  const msg = { type: 'chat', text };
  if (selectedMentions.size > 0) msg.mentions = Array.from(selectedMentions);
  if (attachments) msg.attachments = attachments;

  OIS.ws.send(JSON.stringify(msg));
  input.value = '';
  input.style.height = 'auto';

  selectedMentions.clear();
  document.querySelectorAll('.mention-btn').forEach(b => b.classList.remove('active'));
}

// Init chat input handlers
document.addEventListener('DOMContentLoaded', () => {
  const msgInput = document.getElementById('msg-input');
  if (!msgInput) return;

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  const MAX_INPUT_HEIGHT = 200;
  msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, MAX_INPUT_HEIGHT) + 'px';
  });
});
