const db = require('../lib/db');
const config = require('../lib/config');

// 检测消息文本中的 @提及
// 从 AGENT_TOKENS 动态获取 agent 名称，匹配 @名称 格式
function detectMentions(text) {
  const mentions = [];
  // 从 config.AGENT_TOKENS 中获取所有 agent 信息（现在是 { id, displayName }）
  for (const agentInfo of Object.values(config.AGENT_TOKENS)) {
    // 取 displayName 的第一个词（去掉 emoji 部分）作为匹配名
    const shortName = agentInfo.displayName.replace(/\s.*/, '');
    const regex = new RegExp('@' + shortName, 'i');
    if (regex.test(text)) mentions.push(shortName);
  }
  // 匹配 @all 或 @所有人
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
