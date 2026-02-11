// OIS Files module
let currentPath = '';
let currentFile = '';
let contextMenuItem = null;

async function loadFiles(filePath) {
  currentPath = filePath;
  try {
    const res = await apiFetch(`/api/files?path=${encodeURIComponent(filePath)}`);
    if (!res || !res.ok) return;
    const data = await res.json();
    const parts = filePath.split('/').filter(Boolean);
    let bc = '<a onclick="loadFiles(\'\')">📁 根目录</a>';
    let acc = '';
    parts.forEach(p => { acc += '/' + p; bc += ` / <a onclick="loadFiles('${acc}')">${p}</a>`; });
    document.getElementById('breadcrumb').innerHTML = bc;

    let html = '';
    if (filePath) {
      const parent = parts.slice(0, -1).join('/');
      html += `<div class="file-item" data-path="${parent}" data-is-dir="true" onclick="loadFiles('${parent}')" oncontextmenu="showContextMenu(event, this)"><span class="icon">⬆️</span><span class="name">..</span></div>`;
    }
    data.items.forEach(item => {
      const icon = item.isDir ? '📁' : '📄';
      const fullPath = (currentPath ? currentPath + '/' : '') + item.name;
      const meta = item.isDir ? '' : `<span class="file-meta">${formatSize(item.size)} · ${formatDate(item.modified)}</span>`;
      if (item.isDir) {
        html += `<div class="file-item" data-path="${fullPath}" data-is-dir="true" onclick="loadFiles('${fullPath}')" oncontextmenu="showContextMenu(event, this)"><span class="icon">${icon}</span><span class="name">${item.name}</span>${meta}</div>`;
      } else {
        html += `<div class="file-item" data-path="${fullPath}" data-is-dir="false" onclick="openFile('${fullPath}')" oncontextmenu="showContextMenu(event, this)"><span class="icon">${icon}</span><span class="name">${item.name}</span>${meta}</div>`;
      }
    });
    document.getElementById('file-list').innerHTML = html;
  } catch (e) {}
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function handleFileUpload(files) {
  if (!files || files.length === 0) return;
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OIS.token },
      body: formData
    });
    if (!res.ok) {
      const error = await res.json();
      alert(`上传失败 ${file.name}: ${error.error}`);
    }
  }
  loadFiles(currentPath);
}

async function createNewFolder() {
  const folderName = prompt('请输入新文件夹名称:');
  if (!folderName || folderName.trim() === '') return;
  const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
  try {
    const res = await apiFetch('/api/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: fullPath })
    });
    if (res && res.ok) loadFiles(currentPath);
    else { const e = await res.json(); alert(`创建失败: ${e.error}`); }
  } catch (e) { alert(`创建失败: ${e.message}`); }
}

async function openFile(filePath) {
  try {
    const res = await apiFetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    if (!res || !res.ok) return;
    const data = await res.json();
    currentFile = filePath;

    // Check if image
    const ext = filePath.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      showLightbox(`/api/download?path=${encodeURIComponent(filePath)}`);
      return;
    }

    document.getElementById('editor-path').textContent = filePath;
    document.getElementById('editor-content').value = data.content;
    document.getElementById('files-panel').classList.remove('active');
    document.getElementById('editor-panel').classList.add('active');
  } catch (e) {}
}

async function saveFile() {
  const content = document.getElementById('editor-content').value;
  await apiFetch('/api/file', {
    method: 'POST',
    body: JSON.stringify({ path: currentFile, content })
  });
  alert('已保存!');
}

function closeEditor() {
  document.getElementById('editor-panel').classList.remove('active');
  document.getElementById('files-panel').classList.add('active');
}

// Context menu
const contextMenu = document.getElementById('context-menu');
document.addEventListener('click', () => {
  if (contextMenu) contextMenu.classList.add('hidden');
});

function showContextMenu(e, itemElement) {
  e.preventDefault();
  contextMenuItem = itemElement;
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.classList.remove('hidden');
  const isDir = itemElement.dataset.isDir === 'true';
  const dlBtn = document.querySelector('#context-menu div[onclick="downloadFile()"]');
  if (dlBtn) dlBtn.style.display = isDir ? 'none' : 'block';
}

async function downloadFile() {
  if (!contextMenuItem || contextMenuItem.dataset.isDir === 'true') return;
  window.open(`/api/download?path=${encodeURIComponent(contextMenuItem.dataset.path)}`, '_blank');
  contextMenu.classList.add('hidden');
}

async function renameFile() {
  if (!contextMenuItem) return;
  const oldPath = contextMenuItem.dataset.path;
  const oldName = oldPath.split('/').pop();
  const newName = prompt(`重命名 "${oldName}" 为:`, oldName);
  if (!newName || newName.trim() === '' || newName === oldName) return;
  const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
  const newPath = parentPath ? parentPath + '/' + newName : newName;
  try {
    const res = await apiFetch('/api/rename', {
      method: 'POST',
      body: JSON.stringify({ oldPath, newPath })
    });
    if (res && res.ok) loadFiles(currentPath);
    else { const e = await res.json(); alert(`重命名失败: ${e.error}`); }
  } catch (e) { alert(`重命名失败: ${e.message}`); }
  contextMenu.classList.add('hidden');
}

async function deleteFile() {
  if (!contextMenuItem) return;
  const filePath = contextMenuItem.dataset.path;
  const isDir = contextMenuItem.dataset.isDir === 'true';
  const confirmMsg = isDir ? `确定删除文件夹 "${filePath}" 及其所有内容?` : `确定删除 "${filePath}"?`;
  if (!confirm(confirmMsg)) return;
  try {
    const res = await apiFetch(`/api/file?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' });
    if (res && res.ok) loadFiles(currentPath);
    else { const e = await res.json(); alert(`删除失败: ${e.error}`); }
  } catch (e) { alert(`删除失败: ${e.message}`); }
  contextMenu.classList.add('hidden');
}
