/**
 * E2E 测试文件 - 测试 AI 助手功能
 *
 * 【重要】测试隔离说明：
 * - fake claude 只在测试进程内使用，通过修改 PATH 环境变量实现
 * - 测试数据使用 JOBFINDER_DATA_DIR 环境变量隔离到临时目录
 * - 临时目录使用 mkdtempSync 创建在系统临时目录中：
 *   - testDataDir: /tmp/jobfinder-test-data-xxxxxx/（测试数据）
 *   - fakeBinDir:  /tmp/jobfinder-e2e-xxxxxx/（fake claude）
 * - 测试结束后，afterAll 会清理所有临时目录
 * - fake 只影响测试服务器进程（端口 8999），不影响线上服务（端口 8082）
 * - 线上服务使用真实 Claude CLI，所有数据保存在项目 uploads 目录
 */

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEST_PORT = 8999;  // 测试使用不同端口，避免与线上冲突
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;
let fakeBinDir;
let testDataDir;

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('服务器启动超时')), 10000);
    proc.stdout.on('data', (data) => {
      if (data.toString().includes('OK')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`服务器提前退出: ${code}`));
    });
  });
}

test.beforeAll(async () => {
  // 创建临时测试数据目录（隔离测试数据，不污染生产目录）
  testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfinder-test-data-'));
  // 创建 fake claude（只在 PATH 内生效）
  fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfinder-e2e-bin-'));
  const fakeClaudePath = path.join(fakeBinDir, 'claude');
  fs.writeFileSync(fakeClaudePath, '#!/bin/sh\nprintf "模拟回复完成：AI助手发送链路正常"', 'utf8');
  fs.chmodSync(fakeClaudePath, 0o755);

  // 启动测试服务器，使用 JOBFINDER_DATA_DIR 隔离测试数据
  serverProcess = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      JOBFINDER_DATA_DIR: testDataDir,
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH || ''}`,
    },
  });

  await waitForServer(serverProcess);
});

test.afterAll(async () => {
  // 【重要】确保 fake claude 不会污染生产环境
  // 1. 先发送 SIGTERM 信号让服务器优雅退出
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
      // 等待进程退出（最多5秒）
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 5000);
        serverProcess.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    } catch (e) {
      // 进程可能已经退出，忽略错误
    }
    serverProcess = null;
  }
  // 2. 清理测试数据目录
  if (testDataDir) {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch (e) {
      console.error('清理测试数据目录失败:', e.message);
    }
    testDataDir = null;
  }
  // 3. 清理 fake bin 目录
  if (fakeBinDir) {
    try {
      fs.rmSync(fakeBinDir, { recursive: true, force: true });
    } catch (e) {
      console.error('清理临时目录失败:', e.message);
    }
    fakeBinDir = null;
  }
});

test('页面加载成功并默认显示 AI 助手', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.locator('h1')).toContainText('字节跳动');
  await expect(page.locator('#chat-area')).toBeVisible();
  await expect(page.locator('#send-btn')).toBeEnabled();
  await expect(page.locator('.message-ai').first()).toBeVisible();
});

test('AI 助手可以在本地根路径发送消息并恢复输入状态', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('#chat-input').fill('测试消息');
  await page.locator('#send-btn').click();

  await expect(page.locator('.message-user .message-content').last()).toContainText('测试消息');
  await expect(page.locator('.message-ai .message-content').last()).toContainText('模拟回复完成', { timeout: 10000 });
  await expect(page.locator('#send-btn')).toBeEnabled();
  await expect(page.locator('#chat-input')).toHaveValue('');
});

test('AI 助手可以在 /jobfinder 反代路径发送消息', async ({ page }) => {
  await page.goto(`${BASE_URL}/jobfinder`);
  await page.locator('#chat-input').fill('反代路径测试');
  await page.locator('#send-btn').click();

  await expect(page.locator('.message-user .message-content').last()).toContainText('反代路径测试');
  await expect(page.locator('.message-ai .message-content').last()).toContainText('模拟回复完成', { timeout: 10000 });

  const response = await page.request.get(`${BASE_URL}/jobfinder/api/dialogs`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(Array.isArray(data.dialogs)).toBeTruthy();
});

test('文件上传随消息发送并显示文件标记', async ({ page }) => {
  const uploadPath = path.join(os.tmpdir(), `jobfinder-upload-${Date.now()}.txt`);
  fs.writeFileSync(uploadPath, 'resume fixture', 'utf8');

  await page.goto(BASE_URL);
  await page.locator('#file-input').setInputFiles(uploadPath);
  await expect(page.locator('#file-preview')).toContainText(path.basename(uploadPath));
  await page.locator('#chat-input').fill('请分析附件');
  await page.locator('#send-btn').click();

  await expect(page.locator('.message-file').last()).toContainText(path.basename(uploadPath));
  await expect(page.locator('.message-ai .message-content').last()).toContainText('模拟回复完成', { timeout: 10000 });
  // 检查文件是否写入测试数据目录
  expect(fs.existsSync(path.join(testDataDir, 'uploads', path.basename(uploadPath)))).toBeTruthy();
});

test('Tab 切换后 AI 助手仍可继续发送', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('button[data-tab="后端"]').click();
  await expect(page.locator('#tab-后端')).toHaveClass(/active/);
  await expect(page.locator('#tab-后端 .card').first()).toBeVisible();

  await page.locator('button[data-tab="AI助手"]').click();
  await page.locator('#chat-input').fill('切回来继续发送');
  await page.locator('#send-btn').click();

  await expect(page.locator('.message-ai .message-content').last()).toContainText('模拟回复完成', { timeout: 10000 });
});
