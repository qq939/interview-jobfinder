#!/usr/bin/env node
/**
 * 检查script执行错误
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 检查script执行错误 ===\n');

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

  // 监听请求失败
  page.on('requestfailed', request => {
    console.log(`[Request Failed] ${request.url()} - ${request.failure().errorText}`);
  });

  try {
    console.log('访问页面...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // 等待一下让JavaScript执行
    await page.waitForTimeout(1000);

    // 检查所有全局变量
    const globals = await page.evaluate(() => {
      const result = {};
      for (let key in window) {
        try {
          if (typeof window[key] === 'function' && key.toLowerCase().includes('message')) {
            result[key] = typeof window[key];
          }
        } catch (e) {}
      }
      return result;
    });
    console.log('\n=== 包含message的全局函数 ===');
    console.log(JSON.stringify(globals, null, 2));

    // 尝试访问sendMessage
    const sendMsgInfo = await page.evaluate(() => {
      return {
        inWindow: 'sendMessage' in window,
        typeof: typeof sendMessage,
        fromThis: typeof this?.sendMessage
      };
    });
    console.log('\n=== sendMessage检查 ===');
    console.log(JSON.stringify(sendMsgInfo, null, 2));

    // 手动执行script内容
    const scriptContent = await page.evaluate(() => {
      const script = document.querySelector('script');
      return script ? script.textContent : null;
    });

    console.log('\n=== 手动重新执行script ===');
    try {
      eval(scriptContent);
      console.log('eval成功');

      // 检查函数
      const afterEval = await page.evaluate(() => {
        return {
          sendMessage: typeof sendMessage,
          loadHistory: typeof loadHistory,
          addMessage: typeof addMessage
        };
      });
      console.log(JSON.stringify(afterEval, null, 2));
    } catch (e) {
      console.log('eval失败:', e.message);
    }

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);