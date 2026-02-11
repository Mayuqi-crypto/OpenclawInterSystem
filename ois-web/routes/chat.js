const express = require('express');
const router = express.Router();
const config = require('../lib/config');
const auth = require('../lib/auth');

// 用户登录：验证密码，创建 session
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (password === config.PASSWORD && username) {
    const session = auth.createSession(username);
    res.json({ ok: true, token: session.token, user: session.user });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

// 验证 token 有效性
router.get('/verify', (req, res) => {
  const user = auth.getUser(req);
  if (user) {
    res.json({ ok: true, user });
  } else {
    res.status(401).json({ error: 'Token 无效' });
  }
});

// 成员列表（从 AGENT_TOKENS 动态生成）
// 返回 name（纯 ASCII id，用于 @提及匹配）和 display（带 emoji 的展示名）
router.get('/members', auth.requireAuth, (req, res) => {
  const members = Object.values(config.AGENT_TOKENS).map(({ id, displayName }) => {
    // name 用于 @提及检测（取 displayName 的第一个词，如 "ARIA"）
    const mentionName = displayName.replace(/\s.*/, '');
    return { name: mentionName, display: displayName, id };
  });
  res.json({ members });
});

module.exports = router;
