const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 7 * 24 * 3600 * 1000;
  db.saveSession(token, username, expires);
  return { token, user: username };
}

function verifySession(token) {
  if (!token) return null;
  const session = db.getSession(token);
  if (session && session.expires > Date.now()) {
    return session.user;
  }
  return null;
}

function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return verifySession(token);
}

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

function verifyAgentToken(token) {
  return config.AGENT_TOKENS[token] || null;
}

module.exports = { createSession, verifySession, getUser, requireAuth, verifyAgentToken };
