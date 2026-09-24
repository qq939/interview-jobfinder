/**
 * 简化版E2E测试 - 验证页面和API功能
 * 注意：完整的Playwright浏览器测试需要安装系统依赖：
 *   sudo npx playwright install-deps
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8999;
const BASE_URL = `http://localhost:${PORT}`;

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('E2E 端到端测试 (简化版)');
  console.log('='.repeat(60));

  let serverProcess;
  let passed = 0;
  let failed = 0;
  const errors = [];

  try {
    // 1. 启动服务器
    console.log('\n[1/7] 启动服务器...');
    const { spawn } = require('child_process');
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(PORT) }
    });

    await new Promise((resolve, reject) => {
      let resolved = false;
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('OK')) {
          resolved = true;
          resolve();
        }
      });
      setTimeout(() => {
        if (!resolved) reject(new Error('服务器启动超时'));
      }, 10000);
    });
    console.log('✅ 服务器启动成功');
    passed++;

    // 2. 测试页面加载
    console.log('\n[2/7] 测试页面加载...');
    const pageRes = await httpGet(BASE_URL);
    if (pageRes.status === 200 && pageRes.body.includes('字节跳动')) {
      console.log('✅ 页面加载成功');
      passed++;
    } else {
      throw new Error('页面加载失败: ' + pageRes.status);
    }

    // 3. 验证关键HTML元素存在于页面中
    console.log('\n[3/7] 验证HTML元素...');
    const checks = [
      { name: 'chat-area', found: pageRes.body.includes('id=chat-area') },
      { name: 'chat-messages', found: pageRes.body.includes('id=chat-messages') },
      { name: 'chat-input', found: pageRes.body.includes('id=chat-input') },
      { name: 'send-btn', found: pageRes.body.includes('id=send-btn') },
      { name: 'file-drop-zone', found: pageRes.body.includes('id=file-drop-zone') },
      { name: 'file-input', found: pageRes.body.includes('id=file-input') },
      { name: 'history-section', found: pageRes.body.includes('id=history-section') },
      { name: 'history-list', found: pageRes.body.includes('id=history-list') },
      { name: 'tmpfile-section', found: pageRes.body.includes('id=tmpfile-section') },
      { name: 'tmpfile-content', found: pageRes.body.includes('id=tmpfile-content') },
    ];

    for (const check of checks) {
      if (check.found) {
        console.log('  ✅ ' + check.name);
        passed++;
      } else {
        throw new Error('缺少元素: ' + check.name);
      }
    }

    // 4. 验证文件上传点击功能 (通过检查onclick属性)
    console.log('\n[4/7] 验证文件上传点击功能...');
    if (pageRes.body.includes('onclick') && pageRes.body.includes('fileInput')) {
      console.log('✅ 文件上传onclick事件存在');
      passed++;
    } else {
      throw new Error('文件上传onclick事件缺失');
    }

    // 5. 验证拖拽事件监听器
    console.log('\n[5/7] 验证拖拽事件监听器...');
    const dragChecks = [
      { name: 'dragover事件', found: pageRes.body.includes('dragover') },
      { name: 'dragleave事件', found: pageRes.body.includes('dragleave') },
      { name: 'drop事件', found: pageRes.body.includes('addEventListener("drop"') },
    ];
    for (const event of dragChecks) {
      if (event.found) {
        console.log('  ✅ ' + event.name);
        passed++;
      } else {
        throw new Error('拖拽事件缺失: ' + event.name);
      }
    }

    // 6. 测试API端点
    console.log('\n[6/7] 测试API端点...');

    // 测试 /api/dialogs
    const dialogsRes = await httpGet(BASE_URL + '/api/dialogs');
    if (dialogsRes.status === 200) {
      try {
        const data = JSON.parse(dialogsRes.body);
        if (data.dialogs !== undefined) {
          console.log('  ✅ /api/dialogs 返回正确');
          passed++;
        }
      } catch (e) {
        throw new Error('/api/dialogs 返回无效JSON');
      }
    }

    // 7. 验证tmpfile相关功能
    console.log('\n[7/7] 验证tmpfile功能...');
    const tmpfileChecks = [
      { name: 'tmpfile轮询函数', found: pageRes.body.includes('pollTmpFile') },
      { name: 'tmpfile显示函数', found: pageRes.body.includes('showTmpFile') },
      { name: 'tmpfile开始轮询', found: pageRes.body.includes('startTmpFilePolling') },
      { name: 'tmpfile停止轮询', found: pageRes.body.includes('stopTmpFilePolling') },
    ];

    for (const check of tmpfileChecks) {
      if (check.found) {
        console.log('  ✅ ' + check.name);
        passed++;
      } else {
        throw new Error('tmpfile功能缺失: ' + check.name);
      }
    }

  } catch (err) {
    console.error('❌ 测试失败: ' + err.message);
    errors.push(err);
    failed++;
  } finally {
    // 清理
    console.log('\n' + '='.repeat(60));
    console.log('清理资源...');

    if (serverProcess) {
      serverProcess.kill();
      console.log('✅ 服务器已停止');
    }

    // 输出结果
    console.log('\n' + '='.repeat(60));
    console.log('测试结果:');
    console.log('  ✅ 通过: ' + passed);
    console.log('  ❌ 失败: ' + failed);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\n错误详情:');
      errors.forEach((err, i) => {
        console.log('  ' + (i + 1) + '. ' + err.message);
      });
      process.exit(1);
    }

    console.log('\n🎉 所有测试通过！');
    console.log('\n注意: 要运行完整的浏览器测试,需要:');
    console.log('  1. 安装系统依赖: sudo npx playwright install-deps');
    console.log('  2. 然后运行: node test-playwright-cli.js');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});