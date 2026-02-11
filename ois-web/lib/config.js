const path = require('path');

const config = {
  PORT: parseInt(process.env.PORT || '8800', 10),
  OIS_ROOT: process.env.OIS_ROOT || '/data/data/OpenclawInterSystem',
  UPLOAD_DIR: process.env.UPLOAD_DIR || '/tmp/ois-uploads/',
  PASSWORD: process.env.PASSWORD,
  HEARTBEAT_INTERVAL: 30000,
  MAX_HISTORY: 500,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000,
  RATE_LIMIT_MAX_LOGIN: 10,
  RATE_LIMIT_MAX_API: 100,
};

// 解析 AGENT_TOKENS（格式: token1:显示名1,token2:显示名2）
// 内部会自动生成纯 ASCII 的 agent id（去掉 emoji 和空格），用于 URL 路由和 Map key
// display_name 保留原始名称（含 emoji），仅用于前端展示
config.AGENT_TOKENS = {};   // token -> { id, displayName }
config.AGENT_IDS = {};      // id -> displayName（反向查找）
if (process.env.AGENT_TOKENS) {
  process.env.AGENT_TOKENS.split(',').forEach(pair => {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) return;
    const token = pair.substring(0, colonIdx).trim();
    const displayName = pair.substring(colonIdx + 1).trim();
    if (!token || !displayName) return;
    // 从显示名中提取纯 ASCII id：去掉 emoji 和特殊字符，只保留字母数字
    const id = displayName.replace(/[^\w]/g, '').toUpperCase() || displayName;
    config.AGENT_TOKENS[token] = { id, displayName };
    config.AGENT_IDS[id] = displayName;
  });
}

// Validate required config
function validate() {
  if (!config.PASSWORD) {
    console.error('ERROR: PASSWORD not set in .env file');
    process.exit(1);
  }
  if (Object.keys(config.AGENT_TOKENS).length === 0) {
    console.error('ERROR: AGENT_TOKENS not set in .env file');
    process.exit(1);
  }
}

module.exports = { ...config, validate };
