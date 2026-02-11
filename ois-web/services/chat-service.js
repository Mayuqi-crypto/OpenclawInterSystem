const db = require('../lib/db');
const config = require('../lib/config');

function detectMentions(text) {
  const mentions = [];
  // Dynamic detection from AGENT_TOKENS
  for (const name of Object.values(config.AGENT_TOKENS)) {
    const shortName = name.replace(/\s.*/, '');
    const regex = new RegExp('@' + shortName, 'i');
    if (regex.test(text)) mentions.push(shortName);
  }
  if (/@all/i.test(text) || /@所有人/.test(text)) mentions.push('all');
  return mentions;
}

function processMessage(user, text, attachments) {
  const mentions = detectMentions(text);
  const msg = {
    user,
    text,
    time: new Date().toISOString(),
    mentions: mentions.length > 0 ? mentions : undefined,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  };
  const saved = db.addMessage(msg);
  return saved;
}

function getHistory(limit = 100) {
  return db.getRecentMessages(limit);
}

module.exports = { detectMentions, processMessage, getHistory };
