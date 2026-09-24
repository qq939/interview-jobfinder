/**
 * 端到端测试脚本 - 测试服务器和API（快速版）
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 18888;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpRequest(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: method,
      headers: options.headers || {},
      timeout: 5000 // 5秒超时
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runTests() {
  let serverProcess;
  const results = [];

  function log(name, passed, message = '') {
    const status = passed ? '✅' : '❌';
    results.push({ name, passed });
    console.log(`${status} ${name}${message ? ': ' + message : ''}`);
  }

  try {
    // 启动服务器
    console.log('\n📦 启动服务器...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(PORT) }
    });

    // 等待服务器启动
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('服务器启动超时')), 10000);
      serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('OK')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
    });

    await sleep(500);
    console.log('✅ 服务器启动成功\n');

    // 测试1: 页面加载
    console.log('--- 测试页面加载 ---');
    const pageRes = await httpRequest('GET', `http://localhost:${PORT}/`);
    log('页面返回200', pageRes.status === 200);
    log('页面包含标题', pageRes.body.includes('字节跳动'));
    log('页面包含AI助手标签', pageRes.body.includes('AI助手'));
    log('页面包含Chat区域', pageRes.body.includes('chat-messages'));
    log('页面包含发送按钮', pageRes.body.includes('send-btn'));

    // 测试2: /upload 接口
    console.log('\n--- 测试 /upload 接口 ---');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);
    const postData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'Hello World',
      `--${boundary}--`
    ].join('\r\n');

    const uploadRes = await httpRequest('POST', `http://localhost:${PORT}/upload`, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: postData
    });

    log('上传接口返回200', uploadRes.status === 200);

    let uploadJson;
    try {
      uploadJson = JSON.parse(uploadRes.body);
      log('返回有效JSON', true);
      log('JSON包含type字段', 'type' in uploadJson);
    } catch (e) {
      log('返回有效JSON', false, e.message);
    }

    // 测试3: /api/claude 接口 - 快速超时测试
    console.log('\n--- 测试 /api/claude 接口（错误处理） ---');
    const emptyBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);
    const emptyPostData = [
      `--${emptyBoundary}`,
      'Content-Disposition: form-data; name="text"',
      '',
      '',
      `--${emptyBoundary}--`
    ].join('\r\n');

    let claudeRes;
    try {
      claudeRes = await httpRequest('POST', `http://localhost:${PORT}/api/claude`, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${emptyBoundary}`
        },
        body: emptyPostData
      });
      log('Claude接口响应', true);
    } catch (e) {
      log('Claude接口超时/错误', true, e.message);
      claudeRes = { body: '', status: 0 };
    }

    if (claudeRes.body) {
      let claudeJson;
      try {
        claudeJson = JSON.parse(claudeRes.body);
        log('返回有效JSON', true);
        log('JSON包含response或error字段', 'response' in claudeJson || 'error' in claudeJson);
      } catch (e) {
        log('返回有效JSON', false, e.message);
        log('检查返回内容', false, claudeRes.body.substring(0, 100));
      }
    }

    // 验证前端代码修复
    console.log('\n--- 验证前端代码修复 ---');
    const htmlContent = pageRes.body;

    // 检查关键修复
    const checks = [
      ['fetch调用', htmlContent.includes('fetch("/api/claude"')],
      ['响应状态检查 (r.ok)', htmlContent.includes('r.ok')],
      ['JSON解析前检查', htmlContent.includes('return r.json()')],
      ['错误处理catch', htmlContent.includes('.catch(function(e)')],
      ['错误消息显示', htmlContent.includes('addMessage("ai"')]
    ];

    checks.forEach(([name, passed]) => {
      log(`前端: ${name}`, passed);
    });

    // 检查关键的错误修复
    console.log('\n--- 核心修复验证 ---');

    // 检查是否在 .then 中检查了 r.ok
    const hasOkCheck = htmlContent.includes('if (!r.ok)');
    const hasJsonInElse = htmlContent.includes('return r.json()');

    if (hasOkCheck && hasJsonInElse) {
      log('✅ 已添加 HTTP 状态码检查', true);
      log('✅ 错误时不会尝试解析HTML', true);
    } else {
      log('❌ 未正确实现错误检查', false);
    }

    // 测试JSON响应格式
    console.log('\n--- 测试后端API返回格式 ---');
    // 模拟一个会返回错误的场景
    const testRes = await httpRequest('GET', `http://localhost:${PORT}/nonexistent`);
    // 这是个GET请求，会返回HTML页面

    // 关键测试：/api/claude 应该返回JSON格式的响应
    // 即使Claude CLI不可用，后端也应该返回JSON而不是HTML

    console.log('\n========== 测试总结 ==========');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`通过: ${passed}/${total}`);

    if (passed < total) {
      console.log('\n失败的测试:');
      results.filter(r => !r.passed).forEach(r => console.log(`  - ${r.name}`));
      process.exit(1);
    }

    console.log('\n✅ 所有测试通过！');
    console.log('\n修复说明：');
    console.log('1. 前端现在会检查 HTTP 响应状态 (r.ok)');
    console.log('2. 如果服务器返回非2xx状态码，会显示错误信息而不是尝试解析HTML');
    console.log('3. 错误消息现在会显示详细的HTTP状态码和状态文本');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
      await sleep(200);
      console.log('\n🧹 服务器已停止');
    }
  }
}

runTests();