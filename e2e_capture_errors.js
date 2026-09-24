#!/usr/bin/env node
/**
 * 捕获所有JavaScript错误
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 捕获JavaScript错误 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 监听所有console消息
  page.on('console', msg => {
    console.log(`[Console ${msg.type()}] ${msg.text()}`);
  });

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`[Page Error] ${error.message}`);
  });

  // 监听请求
  page.on('request', request => {
    if (request.url().includes('localhost')) {
      console.log(`[Request] ${request.method()} ${request.url()}`);
    }
  });

  // 监听响应
  page.on('response', response => {
    if (response.url().includes('localhost')) {
      console.log(`[Response] ${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log('访问页面...\n');
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    console.log(`HTTP状态: ${response.status()}\n`);

    // 等待JavaScript执行
    await page.waitForTimeout(2000);

    // 检查chatInput是否存在
    const chatInputExists = await page.evaluate(() => {
      return {
        exists: document.getElementById('chat-input') !== null,
        value: document.getElementById('chat-input')?.value
      };
    });
    console.log('chatInput:', chatInputExists);

    // 检查所有函数
    const allFunctions = await page.evaluate(() => {
      const funcs = ['switchTab', 'handleKeyDown', 'addMessage', 'setLoading',
                     'safeParseJSON', 'clearInput', 'formatTime', 'showTmpFile',
                     'updateTmpFileStatus', 'hideTmpFile', 'pollTmpFile',
                     'startTmpFilePolling', 'stopTmpFilePolling', 'loadHistory',
                     'showDialog', 'sendMessage'];
      const result = {};
      funcs.forEach(f => {
        result[f] = typeof window[f];
      });
      return result;
    });
    console.log('\n=== 函数检查 ===');
    Object.entries(allFunctions).forEach(([name, type]) => {
      console.log(`  ${name}: ${type}`);
    });

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);