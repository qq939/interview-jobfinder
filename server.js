
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const mammoth = require('mammoth');

const PORT = process.env.PORT || 8082;

// 数据根目录：支持通过环境变量配置，默认使用项目根目录
const DATA_ROOT = process.env.JOBFINDER_DATA_DIR || __dirname;

// 所有数据路径都从 DATA_ROOT 派生
const UPLOAD_DIR = path.join(DATA_ROOT, 'uploads');
const EXTRACT_DIR = path.join(DATA_ROOT, 'uploads', 'extracted');
const DIALOGS_DIR = path.join(DATA_ROOT, 'uploads', 'dialogs');
const TMPFILE_PATH = path.join(DATA_ROOT, 'uploads', 'tmpfile.txt');
const SKILL_PATH = path.join(__dirname, 'SKILL.md');  // SKILL.md 保持在项目目录
const TIMEOUT_MS = 1200000; // 1200秒 = 20分钟
const HISTORY_USER_LIMIT = 1000;
const HISTORY_AI_LIMIT = 2000;

// 确保数据目录存在
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, {recursive:true});
if (!fs.existsSync(EXTRACT_DIR)) fs.mkdirSync(EXTRACT_DIR, {recursive:true});
if (!fs.existsSync(DIALOGS_DIR)) fs.mkdirSync(DIALOGS_DIR, {recursive:true});

const PAGE_HTML = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8');

// 读取 SKILL.md 职责部分
function getSkillResponsibilities() {
  if (fs.existsSync(SKILL_PATH)) {
    const content = fs.readFileSync(SKILL_PATH, 'utf8');
    // 提取职责部分（从 ## 职责 到下一个 ## 之前的部分）
    const match = content.match(/## 职责\s*\n([\s\S]*?)(?=##|\Z)/);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

// 读取完整 SKILL.md
function getSkillContent() {
  if (fs.existsSync(SKILL_PATH)) {
    return fs.readFileSync(SKILL_PATH, 'utf8');
  }
  return '';
}

// 只读取 SKILL.md 中"核心职责 + 用户基本信息 + 最近对话简要说明 + 交付件元数据"四节（机器可识别小标题）
function getSkillMinimal() {
  if (!fs.existsSync(SKILL_PATH)) return '';
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  const targets = ['核心职责', '用户基本信息', '最近对话简要说明', '交付件元数据'];
  // 用 split by "^## "（多行模式）切分；第 0 段是 front matter，跳过
  const sections = content.split(/^## /m).slice(1);
  const blocks = [];
  for (const t of targets) {
    for (let i = 0; i < sections.length; i++) {
      const firstLine = sections[i].split('\n')[0].trim();
      // firstLine 可能带"（机器可识别）"等中文修饰
      if (firstLine === t || firstLine.startsWith(t + '（') || firstLine.startsWith(t + '(')) {
        const rest = sections[i].split('\n').slice(1).join('\n').trim();
        blocks.push(`## ${t}\n${rest}`);
        break;
      }
    }
  }
  return blocks.join('\n\n');
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function getClaudeRuntimeEnv() {
  const result = {};
  const home = process.env.HOME || '';
  const configPaths = [
    home ? path.join(home, '.claude', 'config.json') : '',
    '/agent-config/config.json'
  ].filter(Boolean);

  for (const configPath of configPaths) {
    const config = readJsonFile(configPath);
    const current = config && config.claude && config.claude.current;
    const provider = current && config.claude.providers && config.claude.providers[current];
    const env = provider && provider.settingsConfig && provider.settingsConfig.env;
    if (env) Object.assign(result, env);
  }

  return result;
}

function truncateText(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + `\n...（已截断，原长度 ${text.length} 字符）`;
}

function formatRecentDialogsForPrompt(n = 5) {
  const recentDialogs = getRecentDialogs(n);
  if (!recentDialogs.length) return '';

  let historySection = '【最近对话历史（最多5轮，长内容已截断）】\n';
  recentDialogs.forEach((dialog, index) => {
    const num = recentDialogs.length - index;
    historySection += `\n--- 第 ${num} 轮 ---\n`;
    historySection += `【用户】${truncateText(dialog.userMessage, HISTORY_USER_LIMIT)}\n`;
    historySection += `【Claude】${truncateText(dialog.aiResponse || '（无回复）', HISTORY_AI_LIMIT)}\n`;
  });
  return historySection + '\n---\n\n';
}

// 只生成最近 N 轮对话的"简要说明 + 交付件元数据"两行（不再塞长 body）
function formatRecentDialogsSummary(n = 5) {
  const recentDialogs = getRecentDialogs(n);
  if (!recentDialogs.length) return '';
  const lines = [`【最近对话简要说明（最多 ${n} 轮）】`];
  recentDialogs.forEach((dialog, index) => {
    const num = recentDialogs.length - index;
    const userBrief = truncateText((dialog.userMessage || '').replace(/\s+/g, ' ').slice(0, 80), 80);
    const aiBrief = truncateText(((dialog.aiResponse || '') + '').replace(/\s+/g, ' ').slice(0, 80), 80);
    const ts = dialog.timestamp ? new Date(dialog.timestamp).toISOString().slice(0, 19).replace('T', ' ') : '?';
    lines.push(`  ${num}. [${ts}] 用户: ${userBrief} | Claude: ${aiBrief}`);
  });
  // 交付件元数据：本对话产物（如有 dialog.deliverables 则列出）
  const lastDeliverables = recentDialogs.find(d => d.deliverables) || null;
  if (lastDeliverables && lastDeliverables.deliverables && lastDeliverables.deliverables.length) {
    lines.push(`【交付件元数据】`);
    lastDeliverables.deliverables.forEach(d => {
      lines.push(`  - ${d.type || 'file'}: ${d.name || d.path || ''} (${d.url || d.localPath || ''})`);
    });
  }
  return lines.join('\n') + '\n\n';
}

function logClaudeDebug(stage, info) {
  const payload = {
    time: new Date().toISOString(),
    stage: stage,
    ...info
  };
  console.error('[ClaudeDebug]', JSON.stringify(payload));
}

// 生成唯一ID
function generateId() {
  return 'dialog_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function normalizeUrl(rawUrl) {
  var url = rawUrl.split('?')[0];
  if (url === '/jobfinder') return '/';
  if (url.indexOf('/jobfinder/') === 0) return url.substring('/jobfinder'.length);
  return url;
}

function safeUploadName(fileName) {
  return path.basename(fileName || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

// 保存对话记录
function saveDialog(dialog) {
  const filePath = path.join(DIALOGS_DIR, dialog.id + '.json');
  fs.writeFileSync(filePath, JSON.stringify(dialog, null, 2), 'utf8');
  return filePath;
}

// 读取所有对话（按时间倒序）
function getAllDialogs() {
  const files = fs.readdirSync(DIALOGS_DIR).filter(f => f.endsWith('.json'));
  const dialogs = files.map(f => {
    const content = fs.readFileSync(path.join(DIALOGS_DIR, f), 'utf8');
    return JSON.parse(content);
  });
  // 按时间倒序
  dialogs.sort((a, b) => b.timestamp - a.timestamp);
  return dialogs;
}

// 获取最近N轮对话
function getRecentDialogs(n = 5) {
  const all = getAllDialogs();
  return all.slice(0, n);
}

// 获取指定对话
function getDialog(id) {
  const filePath = path.join(DIALOGS_DIR, id + '.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

function walkDir(dir, base) {
  var r = [], ents = fs.readdirSync(dir, {withFileTypes:true});
  for (var i=0;i<ents.length;i++) {
    var e = ents[i], fp = path.join(dir, e.name);
    if (e.isDirectory()) r = r.concat(walkDir(fp, base)); else r.push({name: path.relative(base, fp), size: fs.statSync(fp).size});
  }
  return r;
}

function extractAndList(fp, name) {
  var ext = path.extname(fp).toLowerCase();
  var r = {type:'other', entries:[], fileSize:fs.statSync(fp).size};
  if (ext === '.zip') {
    r.type = 'zip'; var out = path.join(EXTRACT_DIR, path.basename(name, '.zip') + '_' + Date.now());
    fs.mkdirSync(out, {recursive:true});
    try { new AdmZip(fp).extractAllTo(out, true); r.entries = walkDir(out, out); r.extractDir = out; } catch(e) { r.error = e.message; }
  } else if (['.pdf','.doc','.docx','.txt','.png','.jpg','.jpeg'].indexOf(ext) !== -1) {
    r.type = 'resume'; r.entries = [{name: name, size: r.fileSize}];
  } else { r.entries = [{name: name, size: r.fileSize}]; }
  return r;
}

function parseFormData(req) {
  return new Promise(function(resolve, reject) {
    var chunks = [];
    req.on('data', function(c){chunks.push(c);});
    req.on('end', function() {
      var body = Buffer.concat(chunks);
      var m = req.headers['content-type'] && req.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!m) { resolve({files:[]}); return; }
      var boundary = '--' + (m[1]||m[2]);
      var parts = body.toString('binary').split(boundary).filter(function(p){ return p.length>0 && !/^--$/.test(p.trim()); });
      var files = [];
      for (var i=0;i<parts.length;i++) {
        var part = parts[i], he = part.indexOf('\r\n\r\n');
        if (he === -1) continue;
        var hdr = part.substring(0, he), data = part.substring(he+4);
        var nm = hdr.match(/name="([^"]+)"/), fn = hdr.match(/filename="([^"]+)"/);
        // 优先处理有 filename 的文件字段，其次处理普通表单字段
        if (fn && fn[1]) {
          files.push({fieldName:nm[1], fileName:fn[1], data:Buffer.from(data.replace(/\r\n$/,''), 'binary')});
        } else if (nm && nm[1]) {
          files.push({fieldName:nm[1], fileName:'', data:Buffer.from(data.replace(/\r\n$/,''), 'binary')});
        }
      }
      resolve({files:files});
    });
    req.on('error', reject);
  });
}

// 生成 tmpFile 内容（使用唯一的临时文件路径）
// fileName:    单个上传文件名（兼容老接口；多个文件请用 fileNames 数组）
// fileNames:   多个上传文件名数组（v3.8.6+ 多文件上传支持）
// promptedFile: 右侧文件预览选择器勾选"写入提示词"时传入的路径（不进 uploads，仅作 hint）
function generateTmpFileContent(userMessage, fileName, fileNames, promptedFile) {
  // 只读 SKILL.md 的核心职责 + 最近对话简要说明 + 交付件元数据三节
  const skillMinimal = getSkillMinimal();

  // 最近对话的"简要说明 + 交付件元数据"（替代原本整段长 history）
  const historySummary = formatRecentDialogsSummary(5);

  // 文件提示词：上传文件（fileName/fileNames）或预览文件勾选（promptedFile）任一存在都输出
  // 多个上传文件：列在文件名清单里；预览文件：作为"额外 hint"（用户当前正在浏览）追加
  let filePromptBlock = '';
  const allUploaded = Array.isArray(fileNames) && fileNames.length
    ? fileNames
    : (fileName ? [fileName] : []);
  if (allUploaded.length || promptedFile) {
    const lines = [];
    if (allUploaded.length) {
      lines.push(`我已经把 ${allUploaded.length} 个文件上传至 uploads 文件夹，文件名：${allUploaded.join(' / ')}。请优先在 uploads 文件夹中查找和读取这些文件。`);
    }
    if (promptedFile) {
      // 预览文件路径是项目内的绝对路径（来自 fileSelector.value），Claude 可直接读取
      lines.push(`用户当前正在预览文件：${promptedFile}。该文件已存在于服务器磁盘上，请直接用 Read / cat / less / sed 等工具读取（与上述 uploaded 文件并存，可同时引用）。`);
    }
    lines.push('');
    lines.push('默认不要读取 logs/、node_modules/、.git/、test-results/、uploads/dialogs/ 或大体积历史日志。只有用户明确要求排查日志时，才读取 logs/，并且先只看最新 100 行。');
    const filePrompt = lines.join('\n');
    filePromptBlock = `\n\n---\n\n【文件提示词】\n${filePrompt}`;
  }

  // 组合 tmpFile 内容：用户问题 + 最近对话简要说明 + skill.md(三节最小集) [+ 文件提示词] + 用户问题（重复）
  const tmpFileContent = `【用户问题】
${userMessage}

---

${historySummary}${skillMinimal}${filePromptBlock}

---

【用户问题】
${userMessage}`;

  // 生成唯一的临时文件路径（用于CLI调用，调用后会被删除）
  const tmpFile = TMPFILE_PATH + '.tmp.' + Date.now() + '.' + crypto.randomBytes(4).toString('hex');

  // 写入临时文件
  fs.writeFileSync(tmpFile, tmpFileContent, 'utf8');

  // 同时更新持久化的 tmpfile.txt（用于侧边栏显示）
  fs.writeFileSync(TMPFILE_PATH, tmpFileContent, 'utf8');

  return tmpFile;
}

// 调用 Claude CLI（SSE 流式）
// uploadedFilesInfo: [{ originalName, mime, size, savedAs }]
// onDialogReady: (dialogId) => void — 一旦 dialogId 生成就回调，让 SSE handler 能向客户端发同一个 id
function callClaudeSSE(userMessage, fileName, res, isImage, uploadedFilesInfo, onDialogReady, fileNames, promptedFile) {
  const tmpFile = generateTmpFileContent(userMessage, fileName, fileNames, promptedFile);
  // stream-json + include-partial-messages + verbose 共同启用真正的流式增量输出
  // stdout 会变成 NDJSON（每行一个 JSON），常见事件：
  //   {"type":"content_block_delta","delta":{"type":"text_delta","text":"你"}}
  //   {"type":"content_block_stop",...}
  //   {"type":"message_stop",...}
  //   {"type":"result","result":"<完整文本>"}
  const args = [
    '--dangerously-skip-permissions',
    '--continue',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '-p', tmpFile
  ];

  const env = {
    ...process.env,
    ...getClaudeRuntimeEnv(),
    ANTHROPIC_DISABLE_PREFLIGHT: '1',
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/local/bin'
  };
  // 图文模式：上传的是图片时，CLAUDE_IMG=1 让 run_claude.js 自动追加 file://tmp.png 引用
  if (isImage) {
    env.CLAUDE_IMG = '1';
  }

  const dialogId = generateId();
  // 立刻回调 SSE handler：用同一个 id 给客户端，避免客户端 id 与落盘 id 不一致
  try { if (typeof onDialogReady === 'function') onDialogReady(dialogId); } catch (_) {}
  // 读取本轮的完整 prompt 内容（tmpfile.txt 持久化文件），用于事后回放
  let promptContent = '';
  try { promptContent = fs.readFileSync(TMPFILE_PATH, 'utf8'); } catch (_) { /* tmpfile 不存在则留空 */ }

  const dialog = {
    id: dialogId,
    timestamp: Date.now(),
    userMessage: userMessage,
    fileName: fileName || null,
    aiResponse: '',
    // === 完整元数据（v3.8.3 强化：prompt / uploadedFiles / generatedFiles / meta） ===
    prompt: promptContent,
    uploadedFiles: (uploadedFilesInfo && uploadedFilesInfo.length) ? uploadedFilesInfo : (fileName ? [{
      originalName: fileName,
      mime: '',
      size: 0,
      savedAs: path.join(UPLOAD_DIR, fileName)
    }] : []),
    generatedFiles: [],
    meta: {
      session_id: dialogId,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toISOString().slice(11, 19) + ' UTC',
      tmpFile: tmpFile,
      tmpFileBytes: fs.statSync(tmpFile).size,
      isImage: !!isImage,
      mode: 'sse'
    },
    deliverables: []
  };

  logClaudeDebug('spawn:start', {
    mode: 'sse',
    cwd: __dirname,
    args: args,
    tmpFile: tmpFile,
    tmpFileBytes: fs.statSync(tmpFile).size,
    userMessageBytes: Buffer.byteLength(userMessage || '', 'utf8'),
    envPresent: {
      ANTHROPIC_AUTH_TOKEN: !!env.ANTHROPIC_AUTH_TOKEN,
      ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
      ANTHROPIC_BASE_URL: !!env.ANTHROPIC_BASE_URL,
      ANTHROPIC_MODEL: env.ANTHROPIC_MODEL || '',
      ANTHROPIC_DISABLE_PREFLIGHT: env.ANTHROPIC_DISABLE_PREFLIGHT || ''
    }
  });

  const startedAt = Date.now();
  // 立即落盘一次（确保 prompt / uploadedFiles / meta 第一时间可查，append-generated 才能命中）
  dialog.meta.spawnedAt = startedAt;
  dialog.meta.pid = null;
  saveDialog(dialog);

  // 现在才发 session event，id 直接等于 dialogId（保证 append-generated 能命中）
  sendSSEMessage(res, 'session', dialogId);

  const claude = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: env
  });
  dialog.meta.pid = claude.pid || null;
  logClaudeDebug('spawn:pid', {mode: 'sse', pid: claude.pid || null});

  let stdout = '';
  let stderr = '';
  // NDJSON 解析状态：保存上次未完成的行（chunk 可能在行中间被切）
  let ndjsonBuffer = '';
  let resultText = ''; // 累积最终 result.result
  let killed = false;
  let timeoutId = setTimeout(() => {
    if (!killed && claude && !claude.killed) {
      killed = true;
      logClaudeDebug('spawn:timeout', {
        mode: 'sse',
        pid: claude.pid || null,
        elapsedMs: Date.now() - startedAt,
        stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
        stderrBytes: Buffer.byteLength(stderr, 'utf8')
      });
      claude.kill('SIGTERM');
      sendSSEMessage(res, 'error', '请求超时（1200秒），请重试');
      res.end();
      dialog.aiResponse = '（请求超时）';
      saveDialog(dialog);
    }
  }, TIMEOUT_MS);

  claude.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    logClaudeDebug('stdout:chunk', {
      mode: 'sse',
      elapsedMs: Date.now() - startedAt,
      bytes: data.length,
      totalBytes: Buffer.byteLength(stdout, 'utf8')
    });

    // NDJSON 解析：把这一段数据追加到 buffer，按 \n 切，逐行 JSON.parse
    // 提取 content_block_delta.delta.text 作为增量 chunk 推 SSE
    ndjsonBuffer += chunk;
    const lines = ndjsonBuffer.split('\n');
    ndjsonBuffer = lines.pop(); // 最后一段可能不完整，留给下次
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let evt;
      try { evt = JSON.parse(trimmed); }
      catch (e) {
        // 解析失败的行：原样当 chunk 推（兜底，避免丢内容）
        sendSSEMessage(res, 'chunk', trimmed + '\n');
        continue;
      }
      if (!evt || typeof evt !== 'object') continue;

      // 取增量文本
      if (evt.type === 'content_block_delta'
          && evt.delta && evt.delta.type === 'text_delta'
          && typeof evt.delta.text === 'string') {
        sendSSEMessage(res, 'chunk', evt.delta.text);
        continue;
      }
      // message_start / content_block_start / content_block_stop / message_delta / message_stop / ping 都不推
      // 最终完整结果（兜底用）
      if (evt.type === 'result' && typeof evt.result === 'string') {
        resultText = evt.result;
      }
    }
  });

  claude.stderr.on('data', (data) => {
    const chunk = data.toString();
    stderr += chunk;
    logClaudeDebug('stderr:chunk', {
      mode: 'sse',
      elapsedMs: Date.now() - startedAt,
      bytes: data.length,
      totalBytes: Buffer.byteLength(stderr, 'utf8'),
      content: chunk
    });
  });

  claude.on('close', (code) => {
    clearTimeout(timeoutId);
    if (killed) return;
    killed = true;
    logClaudeDebug('spawn:close', {
      mode: 'sse',
      pid: claude.pid || null,
      code: code,
      elapsedMs: Date.now() - startedAt,
      stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
      stderrBytes: Buffer.byteLength(stderr, 'utf8')
    });

    // 清理 tmpFile
    try { fs.unlinkSync(tmpFile); } catch(e) {}

    // 处理 stdout 末尾残留的 NDJSON 行（如果有）
    if (ndjsonBuffer.trim()) {
      try {
        const evt = JSON.parse(ndjsonBuffer.trim());
        if (evt.type === 'result' && typeof evt.result === 'string') {
          resultText = evt.result;
        }
      } catch (e) {}
    }

    if (code === 0) {
      // 优先用 stream-json 给出的最终 result；stream-json 模式下 stdout 是 NDJSON 不能再 trim 当回答
      const finalText = resultText || stdout.trim();
      dialog.aiResponse = finalText;
      saveDialog(dialog);
      sendSSEMessage(res, 'complete', JSON.stringify({dialogId: dialogId, response: finalText}));
    } else {
      dialog.aiResponse = '（错误：' + (stderr || 'Claude进程退出，代码: ' + code) + '）';
      saveDialog(dialog);
      sendSSEMessage(res, 'error', 'Claude错误: ' + (stderr || '进程退出，代码: ' + code));
    }
    res.end();
  });

  claude.on('error', (err) => {
    clearTimeout(timeoutId);
    killed = true;
    logClaudeDebug('spawn:error', {
      mode: 'sse',
      pid: claude.pid || null,
      elapsedMs: Date.now() - startedAt,
      error: err.message
    });
    try { fs.unlinkSync(tmpFile); } catch(e) {}
    dialog.aiResponse = '（启动失败：' + err.message + '）';
    saveDialog(dialog);
    sendSSEMessage(res, 'error', '启动Claude失败: ' + err.message);
    res.end();
  });
}

// 发送 SSE 消息
function sendSSEMessage(res, type, content) {
  res.write('data: ' + JSON.stringify({type: type, content: content}) + '\n\n');
}

http.createServer(function(req, res) {
  var url = normalizeUrl(req.url);

  // 文件上传接口
  if (req.method === 'POST' && url === '/upload') {
    parseFormData(req).then(function(form) {
      if (!form.files.length) { res.writeHead(400,{'Content-Type':'application/json'}); res.end('{"error":"未检测到文件"}'); return; }
      var file = form.files[0];
      var safe = safeUploadName(file.fileName);
      fs.writeFileSync(path.join(UPLOAD_DIR, safe), file.data);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(extractAndList(path.join(UPLOAD_DIR, safe), file.fileName)));
    }).catch(function(e) { res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:e.message})); });
    return;
  }

  // 上传文件到 OBS（http://obs.dimond.top，仅支持根路径）
  if (req.method === 'POST' && url === '/api/uploads/upload-to-obs') {
    parseFormData(req).then(function(form){
      // parseFormData 把所有字段（含普通字段）都放在 files 数组里 — 通过 fieldName 区分
      var name = '';
      for (var i=0;i<form.files.length;i++){
        if (form.files[i].fieldName === 'fileName') { name = form.files[i].data.toString('utf8'); break; }
      }
      if (!name) { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'缺少 fileName 字段'})); return; }
      // 保留原始中文 / Unicode 文件名（uploads/ 里很多文件是外部直接拷贝进来的，未经过 ASCII 化）
      var safe = path.basename(name).replace(/[/\\\x00]/g, '_');
      var filePath = path.join(UPLOAD_DIR, safe);
      if (!filePath.startsWith(UPLOAD_DIR + path.sep)) { res.writeHead(403,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Forbidden'})); return; }
      if (!fs.existsSync(filePath)) { res.writeHead(404,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'本地文件不存在'})); return; }
      var buf = fs.readFileSync(filePath);
      var ext = path.extname(safe).toLowerCase();
      var mimeMap = {'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.doc':'application/msword','.txt':'text/plain','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json'};
      var mime = mimeMap[ext] || 'application/octet-stream';
      var encoded = encodeURIComponent(safe);
      var reqOpts = {hostname:'obs.dimond.top',port:80,path:'/'+encoded,method:'PUT',headers:{'Content-Length':buf.length,'Content-Type':mime,'Access-Control-Allow-Origin':'*'}};
      var obsReq = http.request(reqOpts, function(obsRes){
        var body = '';
        obsRes.on('data', function(c){ body += c; });
        obsRes.on('end', function(){
          res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
          res.end(JSON.stringify({ok: obsRes.statusCode===200||obsRes.statusCode===201, status: obsRes.statusCode, fileName: safe, obsUrl:'http://obs.dimond.top/'+encoded, response: body.slice(0,500)}));
        });
      });
      obsReq.on('error', function(e){
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'OBS 请求失败: '+e.message}));
      });
      obsReq.write(buf);
      obsReq.end();
    }).catch(function(e){ res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:e.message})); });
    return;
  }

  // 静态文件服务（uploads目录）
  if (url.startsWith('/uploads/')) {
    var filePath = path.resolve(__dirname, '.' + decodeURIComponent(url));
    // 安全检查：确保文件在uploads目录内
    if (!filePath.startsWith(UPLOAD_DIR + path.sep) && filePath !== UPLOAD_DIR) {
      res.writeHead(403, {'Content-Type':'text/plain'});
      res.end('Forbidden');
      return;
    }
    if (fs.existsSync(filePath)) {
      var ext = path.extname(filePath).toLowerCase();
      var contentType = {
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }[ext] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': contentType});
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('Not Found');
    }
    return;
  }

  // Claude SSE 聊天接口
  if (req.method === 'POST' && url === '/api/claude-sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // sessionId 由 callClaudeSSE 在生成 dialogId 后再发（保证 id 真正可追溯到 dialog）
    // 这里只设置 SSE headers，不发 session 事件

    parseFormData(req).then(function(form) {
      var text = '';
      var fileName = '';
      var uploadedFileName = '';
      var uploadedFileNames = []; // 多文件清单（v3.8.6+，与单数 fileName 共存）
      var uploadedFilesInfo = []; // [{ originalName, mime, size, savedAs }]
      var promptedFile = ''; // 右侧预览文件 + 「写入提示词」勾选时由前端 formData.append('promptedFile', path)

      // 解析 formData（支持 file / fileName / fileNames / promptedFile）
      for (var i = 0; i < form.files.length; i++) {
        var f = form.files[i];
        if (f.fieldName === 'text') {
          text = f.data.toString('utf8');
        } else if (f.fieldName === 'file' && f.fileName) {
          var safeName = safeUploadName(f.fileName);
          var savedPath = path.join(UPLOAD_DIR, safeName);
          fs.writeFileSync(savedPath, f.data);
          uploadedFilesInfo.push({
            originalName: safeName,
            mime: f.contentType || '',
            size: f.data.length,
            savedAs: savedPath
          });
          uploadedFileNames.push(safeName);
          if (!uploadedFileName) uploadedFileName = safeName;
        } else if (f.fieldName === 'fileName') {
          fileName = safeUploadName(f.data.toString('utf8'));
        } else if (f.fieldName === 'fileNames') {
          // 多文件清单（JSON 数组或换行/逗号分隔）
          var raw = (f.data.toString('utf8') || '').trim();
          try {
            var arr = JSON.parse(raw);
            if (Array.isArray(arr)) arr.forEach(function(n){ uploadedFileNames.push(safeUploadName(n)); });
          } catch (_) {
            raw.split(/[\n,]/).forEach(function(n){ if (n.trim()) uploadedFileNames.push(safeUploadName(n)); });
          }
        } else if (f.fieldName === 'promptedFile') {
          // 预览文件路径（绝对路径，作为 hint 写进文件提示词，不进 uploads）
          promptedFile = (f.data.toString('utf8') || '').trim();
        }
      }

      // 兼容单数 fileName：如果没收到 file 但收到 fileName，把 fileName 加入清单
      if (fileName && uploadedFileNames.indexOf(fileName) === -1) {
        uploadedFileNames.push(fileName);
      }
      // 去重（file 字段 + fileNames 字段可能重名；safeUploadName 后大小写/特殊字符已统一）
      uploadedFileNames = uploadedFileNames.filter(function(n, i, a){ return n && a.indexOf(n) === i; });
      if (!fileName && uploadedFileNames.length) {
        fileName = uploadedFileNames[0];
      }

      // 图文模式：当上传的是图片时，复制为 tmp.png（run_claude.js + CLAUDE_IMG=1 会自动引用）
      // 多文件时：仅对第一个图片做 tmp.png 拷贝（CLAUDE_IMG 模式仅支持单图）
      var isImage = false;
      if (fileName) {
        var ext = path.extname(fileName).toLowerCase();
        if (['.png','.jpg','.jpeg','.gif','.webp','.bmp'].indexOf(ext) !== -1) {
          isImage = true;
          try {
            var srcPath = path.join(UPLOAD_DIR, fileName);
            var tmpPngPath = path.join(DATA_ROOT, 'tmp.png');
            fs.copyFileSync(srcPath, tmpPngPath);
            console.log('SSE 图文模式：已复制为 tmp.png');
          } catch (e) {
            console.error('复制 tmp.png 失败:', e.message);
          }
        }
      }

      // 构建用户消息：fileName 的提示由 generateTmpFileContent() 统一接管，
      // 这里不再重复前缀，避免 tmpfile 第 1 段出现两份"上传文件"说明。
      var userMessage = text;

      console.log('SSE API调用 - 消息长度:', userMessage.length, 'isImage:', isImage, 'fileName:', fileName || '(none)', 'uploaded:', uploadedFilesInfo.length, 'promptedFile:', promptedFile ? 'yes' : 'no');

      callClaudeSSE(userMessage, fileName, res, isImage, uploadedFilesInfo, null, uploadedFileNames, promptedFile);
    }).catch(function(e) {
      console.error('FormData解析失败:', e);
      sendSSEMessage(res, 'error', '解析请求失败: ' + e.message);
      res.end();
    });
    return;
  }

  // 获取对话历史（最后5轮）
  if (req.method === 'GET' && url === '/api/dialogs') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    const dialogs = getRecentDialogs(5);
    res.end(JSON.stringify({dialogs: dialogs}));
    return;
  }

  // 获取指定对话详情
  if (req.method === 'GET' && url.startsWith('/api/dialogs/')) {
    var id = url.split('/').pop();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    const dialog = getDialog(id);
    if (dialog) {
      res.end(JSON.stringify(dialog));
    } else {
      res.end(JSON.stringify({error: '对话不存在'}));
    }
    return;
  }

  // 登记本轮生成的产物（Claude CLI 端在产文件 / 上传 OBS 后调用）
  // POST /api/dialogs/:id/append-generated
  // body: [{ type, name, localPath, url, mime, size, purpose }]
  // 简历交付件只允许 .pdf / .doc / .docx；其他格式（如 .txt / .png）记入 generatedFiles 但不入 deliverables
  var RESUME_EXT = ['.pdf', '.doc', '.docx'];
  if (req.method === 'POST' && url.indexOf('/api/dialogs/') === 0 && url.indexOf('/append-generated') !== -1) {
    var parts = url.split('/');
    var dialogId = parts[3]; // /api/dialogs/<id>/append-generated
    var body = '';
    req.on('data', function(chunk){ body += chunk; });
    req.on('end', function(){
      try {
        var entries = JSON.parse(body || '[]');
        if (!Array.isArray(entries)) entries = [entries];
        var d = getDialog(dialogId);
        if (!d) {
          res.writeHead(404, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
          res.end(JSON.stringify({error: 'dialog not found: ' + dialogId}));
          return;
        }
        // 所有产物都进 generatedFiles（用于审计 / OBS 通道追溯）
        d.generatedFiles = (d.generatedFiles || []).concat(entries);
        // 仅"简历类产物"（pdf/doc/docx）进 deliverables（用于 tmpfile 历史摘要 / 对话元数据）
        if (!d.deliverables) d.deliverables = [];
        var resumeEntries = [];
        var skippedEntries = [];
        entries.forEach(function(e){
          var ext = path.extname((e.name || e.localPath || '')).toLowerCase();
          var isResume = (e.type === 'resume' || e.purpose === 'resume' || RESUME_EXT.indexOf(ext) !== -1);
          if (isResume) {
            d.deliverables.push({
              type: 'resume',
              name: e.name || '',
              localPath: e.localPath || '',
              url: e.url || '',
              meta: { size: e.size || 0, mime: e.mime || '', purpose: e.purpose || '' }
            });
            resumeEntries.push(e.name || e.localPath);
          } else {
            skippedEntries.push(e.name || e.localPath);
          }
        });
        saveDialog(d);
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({
          ok: true,
          received: entries.length,
          asResumeDeliverable: resumeEntries,
          nonResume: skippedEntries,
          generatedFiles: d.generatedFiles.length,
          deliverables: d.deliverables.length
        }));
      } catch (e) {
        res.writeHead(400, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error: 'bad request: ' + e.message}));
      }
    });
    return;
  }

  // 获取 uploads 目录文件列表
  if (req.method === 'GET' && url === '/api/uploads/files') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    try {
      const files = fs.readdirSync(UPLOAD_DIR)
        .filter(f => !f.startsWith('.') && !f.startsWith('dialogs') && !f.startsWith('tmpfile.txt.tmp'))
        .map(f => {
          const fp = path.join(UPLOAD_DIR, f);
          const stat = fs.statSync(fp);
          return {
            name: f,
            size: stat.size,
            isDirectory: stat.isDirectory(),
            createdAt: stat.birthtimeMs || stat.mtimeMs || 0
          };
        })
        .sort((a, b) => {
          // tmpfile.txt 排在最前，然后是目录，最后按名称排序
          if (a.name === 'tmpfile.txt') return -1;
          if (b.name === 'tmpfile.txt') return 1;
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      res.end(JSON.stringify({files: files}));
    } catch (e) {
      res.end(JSON.stringify({files: [], error: e.message}));
    }
    return;
  }

  // 获取指定文件内容（用于预览）
  if (req.method === 'GET' && url.startsWith('/api/uploads/file/')) {
    var fileName = decodeURIComponent(url.split('/').pop());
    var filePath = path.join(UPLOAD_DIR, fileName);
    if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
      res.writeHead(403, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'Forbidden'}));
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'File not found'}));
      return;
    }
    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(fileName).toLowerCase();

      // PDF 文件：返回 base64 编码供 iframe 显示
      if (['.pdf'].indexOf(ext) !== -1) {
        if (stat.size > 10 * 1024 * 1024) {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({error: '文件过大（限制10MB）'}));
          return;
        }
        const content = fs.readFileSync(filePath);
        const base64 = content.toString('base64');
        let mimeType = 'application/pdf';
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          fileName: fileName,
          type: 'embed',
          mimeType: mimeType,
          base64: base64,
          size: stat.size
        }));
        return;
      }

      // DOCX 文件：使用 mammoth 转换为 HTML，前端 iframe srcdoc 渲染
      if (['.docx'].indexOf(ext) !== -1) {
        if (stat.size > 10 * 1024 * 1024) {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({error: '文件过大（限制10MB）'}));
          return;
        }
        mammoth.convertToHtml({path: filePath})
          .then(function(result){
            const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
              'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;' +
              'max-width:800px;margin:1rem auto;padding:0 1rem;line-height:1.6;color:#222;background:#fff;}' +
              'table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ddd;padding:6px 8px;}' +
              'img{max-width:100%;}h1,h2,h3{margin-top:1em;}' +
              '</style></head><body>' + result.value + '</body></html>';
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
              fileName: fileName,
              type: 'docx-html',
              html: html,
              warnings: result.messages.length,
              size: stat.size
            }));
          })
          .catch(function(e){
            res.writeHead(500, {'Content-Type':'application/json'});
            res.end(JSON.stringify({error: 'DOCX 转换失败: ' + e.message}));
          });
        return;
      }

      // 文本文件：直接返回内容
      if (['.txt'].indexOf(ext) !== -1) {
        if (stat.size > 1024 * 1024) {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({error: '文件过大，无法预览'}));
          return;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({content: content, fileName: fileName}));
        return;
      }

      // 其他二进制文件
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({fileName: fileName, type: 'binary', size: stat.size}));
    } catch (e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // 旧的 Claude 聊天接口（保留向后兼容）
  if (req.method === 'POST' && url === '/api/claude') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    parseFormData(req).then(function(form) {
      var text = '';
      var fileName = '';

      for (var i = 0; i < form.files.length; i++) {
        var f = form.files[i];
        if (f.fieldName === 'text') {
          text = f.data.toString('utf8');
        } else if (f.fieldName === 'fileName') {
          fileName = f.data.toString('utf8');
        }
      }

      // 生成 tmpFile
      const tmpFile = generateTmpFileContent(text, fileName);
      const args = ['--dangerously-skip-permissions', '--continue', '-p', tmpFile];

      const env = {
        ...process.env,
        ...getClaudeRuntimeEnv(),
        ANTHROPIC_DISABLE_PREFLIGHT: '1',
        PATH: process.env.PATH || '/usr/bin:/bin:/usr/local/bin'
      };

      logClaudeDebug('spawn:start', {
        mode: 'json',
        cwd: __dirname,
        args: args,
        tmpFile: tmpFile,
        tmpFileBytes: fs.statSync(tmpFile).size,
        userMessageBytes: Buffer.byteLength(text || '', 'utf8'),
        envPresent: {
          ANTHROPIC_AUTH_TOKEN: !!env.ANTHROPIC_AUTH_TOKEN,
          ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
          ANTHROPIC_BASE_URL: !!env.ANTHROPIC_BASE_URL,
          ANTHROPIC_MODEL: env.ANTHROPIC_MODEL || '',
          ANTHROPIC_DISABLE_PREFLIGHT: env.ANTHROPIC_DISABLE_PREFLIGHT || ''
        }
      });

      const startedAt = Date.now();
      const claude = spawn('claude', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env
      });
      logClaudeDebug('spawn:pid', {mode: 'json', pid: claude.pid || null});

      let stdout = '';
      let stderr = '';
      let killed = false;

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
        logClaudeDebug('stdout:chunk', {
          mode: 'json',
          elapsedMs: Date.now() - startedAt,
          bytes: data.length,
          totalBytes: Buffer.byteLength(stdout, 'utf8')
        });
      });
      claude.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        logClaudeDebug('stderr:chunk', {
          mode: 'json',
          elapsedMs: Date.now() - startedAt,
          bytes: data.length,
          totalBytes: Buffer.byteLength(stderr, 'utf8'),
          content: chunk
        });
      });

      claude.on('close', (code) => {
        try { fs.unlinkSync(tmpFile); } catch(e) {}
        if (killed) return;
        logClaudeDebug('spawn:close', {
          mode: 'json',
          pid: claude.pid || null,
          code: code,
          elapsedMs: Date.now() - startedAt,
          stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
          stderrBytes: Buffer.byteLength(stderr, 'utf8')
        });
        if (code === 0) {
          res.end(JSON.stringify({response: stdout.trim()}));
        } else {
          const errMsg = stderr || `Claude进程退出，代码: ${code}`;
          console.error('Claude错误:', errMsg);
          res.end(JSON.stringify({error: errMsg}));
        }
      });

      claude.on('error', (err) => {
        killed = true;
        logClaudeDebug('spawn:error', {
          mode: 'json',
          pid: claude.pid || null,
          elapsedMs: Date.now() - startedAt,
          error: err.message
        });
        try { fs.unlinkSync(tmpFile); } catch(e) {}
        res.end(JSON.stringify({error: '启动Claude失败: ' + err.message}));
      });

      // 20分钟超时
      setTimeout(() => {
        if (!killed && claude && !claude.killed) {
          killed = true;
          logClaudeDebug('spawn:timeout', {
            mode: 'json',
            pid: claude.pid || null,
            elapsedMs: Date.now() - startedAt,
            stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
            stderrBytes: Buffer.byteLength(stderr, 'utf8')
          });
          claude.kill('SIGTERM');
          try { fs.unlinkSync(tmpFile); } catch(e) {}
          res.end(JSON.stringify({error: '请求超时（1200秒），请重试'}));
        }
      }, TIMEOUT_MS);
    }).catch(function(e) {
      res.end(JSON.stringify({error: '解析请求失败: ' + e.message}));
    });
    return;
  }

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS' && (url === '/api/claude' || url === '/api/claude-sse')) {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // /ask/claude GET 接口 - 通过 run_claude.js 中转，超时20分钟
  if (req.method === 'GET' && url.startsWith('/ask/claude')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const q = urlObj.searchParams.get('q');

    if (!q) {
      res.writeHead(400, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Missing q parameter');
      return;
    }

    let question;
    try {
      if (q.includes(' ') || q.length < 50) {
        question = decodeURIComponent(q);
      } else {
        question = Buffer.from(q, 'base64').toString('utf8');
      }
    } catch (e) {
      res.writeHead(400, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Invalid encoding');
      return;
    }

    const systemPrompt = 'You are a helpful assistant. Answer the question concisely. Do not use markdown or formatting.';
    const fullMessage = `${systemPrompt}\n\n${question}`;
    const msgB64 = Buffer.from(fullMessage).toString('base64');

    res.setTimeout(TIMEOUT_MS, () => {
      res.writeHead(504, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Request timeout (60 minutes)');
    });

    const child = spawn('node', [path.join(__dirname, 'run_claude.js')], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ANTHROPIC_DISABLE_PREFLIGHT: '1',
        CLAUDE_CAPTURE_STDIO: '1',
        CLAUDE_MSG: msgB64
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      res.setTimeout(0);
      if (code === 0) {
        res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'});
        res.end(stdout.trim());
      } else {
        res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'});
        res.end(stderr || `Exit code: ${code}`);
      }
    });

    child.on('error', (err) => {
      res.setTimeout(0);
      res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'});
      res.end(`Spawn error: ${err.message}`);
    });

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 5000);
      res.writeHead(504, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Request timeout (60 minutes)');
    }, TIMEOUT_MS);

    child.on('close', () => clearTimeout(timeoutId));

    return;
  }

  // /health 健康检查
  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('OK');
    return;
  }

  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(PAGE_HTML);
}).listen(PORT, '0.0.0.0', {reuseAddress: true}, function() {
  console.log('OK  http://localhost:'+PORT);
});
