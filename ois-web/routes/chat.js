const express = require('express');
const router = express.Router();
const config = require('../lib/config');
const auth = require('../lib/auth');

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (password === config.PASSWORD && username) {
    const session = auth.createSession(username);
    res.json({ ok: true, token: session.token, user: session.user });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Verify token
router.get('/verify', (req, res) => {
  const user = auth.getUser(req);
  if (user) {
    res.json({ ok: true, user });
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Members list (dynamic from AGENT_TOKENS)
router.get('/members', auth.requireAuth, (req, res) => {
  const members = Object.entries(config.AGENT_TOKENS).map(([token, display]) => {
    const name = display.replace(/\s.*/, '');
    return { name, display };
  });
  res.json({ members });
});

module.exports = router;
