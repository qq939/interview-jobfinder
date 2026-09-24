const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置：SKILL.md 路径
const SKILL_PATH = path.join(__dirname, 'SKILL.md');

// 读取系统提示词
function getSystemPrompt() {
  if (fs.existsSync(SKILL_PATH)) {
    return fs.readFileSync(SKILL_PATH, 'utf8');
  }
  return '';
}

// 构建消息：系统提示词 + 用户消息
function buildMessage(systemPrompt, userMessage) {
  if (systemPrompt) {
    return `<system>\n${systemPrompt}\n</system>\n\n<user>\n${userMessage}\n</user>`;
  }
  return userMessage;
}

// 调用 Claude CLI
function callClaude(userMessage) {
  const systemPrompt = getSystemPrompt();
  const msg = buildMessage(systemPrompt, userMessage);

  // base64 编码
  const encodedMsg = Buffer.from(msg, 'utf8').toString('base64');

  const child = spawn('claude', [
    '--dangerously-skip-permissions',
    '--continue',
    '--print',
    encodedMsg
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ANTHROPIC_DISABLE_PREFLIGHT: '1',
      // 如果需要通过环境变量传消息，用这个方式
      // CLAUDE_MSG: encodedMsg
    }
  });

  child.on('error', (err) => {
    console.error('启动失败:', err.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}

// 命令行用法
if (require.main === module) {
  const userMessage = process.argv.slice(2).join(' ');
  if (!userMessage) {
    console.error('用法: node call-claude.js <用户消息>');
    process.exit(1);
  }
  callClaude(userMessage);
}

module.exports = { callClaude };
