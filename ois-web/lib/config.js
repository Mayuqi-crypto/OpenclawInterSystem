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

// Parse AGENT_TOKENS (format: token1:name1,token2:name2)
config.AGENT_TOKENS = {};
if (process.env.AGENT_TOKENS) {
  process.env.AGENT_TOKENS.split(',').forEach(pair => {
    const [token, name] = pair.split(':');
    if (token && name) {
      config.AGENT_TOKENS[token.trim()] = name.trim();
    }
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
