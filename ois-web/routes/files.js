const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const config = require('../lib/config');
const auth = require('../lib/auth');

// Safe path resolution — prevents path traversal
function safePath(userPath) {
  const root = path.resolve(config.OIS_ROOT) + path.sep;
  const resolved = path.resolve(config.OIS_ROOT, userPath || '');
  if (!resolved.startsWith(root) && resolved !== root.slice(0, -1)) {
    return null;
  }
  return resolved;
}

// List files
router.get('/files', auth.requireAuth, async (req, res) => {
  const subPath = req.query.path || '';
  const fullPath = safePath(subPath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const items = entries
      .filter(item => !item.name.startsWith('.') && item.name !== 'ois-web')
      .map(item => {
        const itemPath = path.join(subPath, item.name);
        const stat = fsSync.statSync(path.join(fullPath, item.name));
        return {
          name: item.name,
          isDir: item.isDirectory(),
          path: itemPath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      });
    res.json({ path: subPath, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Read file
router.get('/file', auth.requireAuth, async (req, res) => {
  const filePath = req.query.path || '';
  const fullPath = safePath(filePath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });

  try {
    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ path: filePath, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Write file
router.post('/file', auth.requireAuth, async (req, res) => {
  const { path: filePath, content } = req.body;
  const fullPath = safePath(filePath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });

  try {
    await fs.writeFile(fullPath, content);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download file
router.get('/download', auth.requireAuth, async (req, res) => {
  const filePath = req.query.path || '';
  const fullPath = safePath(filePath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });

  try {
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) return res.status(400).json({ error: 'Cannot download directory' });
    res.download(fullPath, path.basename(filePath));
  } catch (e) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Delete file/directory
router.delete('/file', auth.requireAuth, async (req, res) => {
  const filePath = req.query.path || '';
  const fullPath = safePath(filePath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });

  try {
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rename file/directory
router.post('/rename', auth.requireAuth, async (req, res) => {
  const { oldPath, newPath } = req.body;
  const fullOldPath = safePath(oldPath);
  const fullNewPath = safePath(newPath);
  if (!fullOldPath || !fullNewPath) return res.status(403).json({ error: 'Access denied' });

  try {
    await fs.rename(fullOldPath, fullNewPath);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create directory
router.post('/mkdir', auth.requireAuth, async (req, res) => {
  const { path: dirPath } = req.body;
  const fullPath = safePath(dirPath);
  if (!fullPath) return res.status(403).json({ error: 'Access denied' });

  try {
    await fs.mkdir(fullPath, { recursive: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
