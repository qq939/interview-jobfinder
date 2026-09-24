#!/usr/bin/env node
/**
 * 深度调试测试
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 深度调试测试 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 监听所有console消息
  page.on('console', msg => {
    console.log(`[Browser ${msg.type()}] ${msg.text()}`);
  });

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`[Page Error] ${error.message}`);
  });

  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // 打印页面HTML结构
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log('\n=== body innerHTML (前500字符) ===');
    console.log(bodyHtml);

    // 检查script标签
    const scripts = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      return Array.from(scripts).map(s => ({
        src: s.src,
        hasContent: s.textContent.length > 0,
        contentLength: s.textContent.length,
        first100: s.textContent.substring(0, 100)
      }));
    });
    console.log('\n=== script标签 ===');
    console.log(JSON.stringify(scripts, null, 2));

    // 检查函数
    const functions = await page.evaluate(() => {
      return {
        sendMessage: typeof sendMessage,
        loadHistory: typeof loadHistory,
        addMessage: typeof addMessage,
        switchTab: typeof switchTab,
        window_sendMessage: typeof window.sendMessage
      };
    });
    console.log('\n=== 函数类型 ===');
    console.log(JSON.stringify(functions, null, 2));

    // 尝试直接调用
    const testResult = await page.evaluate(() => {
      try {
        if (typeof sendMessage === 'function') {
          return { success: true, msg: 'sendMessage is a function' };
        } else {
          return { success: false, msg: `sendMessage is ${typeof sendMessage}` };
        }
      } catch (e) {
        return { success: false, msg: e.message };
      }
    });
    console.log('\n=== sendMessage测试 ===');
    console.log(JSON.stringify(testResult, null, 2));

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);