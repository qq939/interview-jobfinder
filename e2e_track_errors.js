#!/usr/bin/env node
/**
 * 跟踪JavaScript错误
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 跟踪JavaScript错误 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`[Page Error] ${error.message}`);
    errors.push(error.message);
  });

  // 监听console错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Console Error] ${msg.text()}`);
      errors.push(msg.text());
    }
  });

  try {
    console.log('访问页面...\n');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // 等待一下
    await page.waitForTimeout(1000);

    // 检查函数
    const funcs = await page.evaluate(() => {
      return {
        sendMessage: typeof sendMessage,
        loadHistory: typeof loadHistory,
        addMessage: typeof addMessage,
        switchTab: typeof switchTab
      };
    });
    console.log('\n函数状态:', funcs);

    // 如果有错误，分析错误
    if (errors.length > 0) {
      console.log('\n发现错误:', errors.length);
    } else {
      console.log('\n没有发现错误');
    }

    // 尝试调用sendMessage
    if (funcs.sendMessage === 'function') {
      console.log('\n尝试调用sendMessage...');
      try {
        const result = await page.evaluate(() => {
          return sendMessage();
        });
        console.log('sendMessage调用结果:', result);
      } catch (e) {
        console.log('sendMessage调用失败:', e.message);
      }
    } else {
      console.log('\nsendMessage未定义，无法调用');
    }

    // 检查chatMessages是否存在
    const chatExists = await page.evaluate(() => {
      return typeof chatMessages !== 'undefined';
    });
    console.log('chatMessages存在:', chatExists);

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);