const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../lib/config');
const auth = require('../lib/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.UPLOAD_DIR)) fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.post('/upload', (req, res) => {
  if (!auth.getUser(req)) return res.status(401).json({ error: 'Unauthorized' });

  upload.single('file')(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      ok: true,
      file: {
        url: fileUrl,
        originalName: req.file.originalname,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        type: req.file.mimetype,
        size: req.file.size,
      }
    });
  });
});

module.exports = router;
