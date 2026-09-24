#!/usr/bin/env node
/**
 * 直接测试函数定义
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 直接测试函数定义 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`[Page Error] ${error.message}`);
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // 直接定义一个简单函数测试
    const test1 = await page.evaluate(() => {
      try {
        eval('function testFunc() { return 123; }');
        return { success: true, result: typeof testFunc };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    console.log('测试1 (简单函数):', test1);

    // 定义loadHistory
    const test2 = await page.evaluate(() => {
      try {
        eval('function loadHistory() { console.log("loadHistory called"); return "ok"; }');
        return { success: true, result: typeof loadHistory };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    console.log('测试2 (loadHistory):', test2);

    // 定义async function sendMessage
    const test3 = await page.evaluate(() => {
      try {
        eval('async function sendMessage() { console.log("sendMessage called"); return "ok"; }');
        return { success: true, result: typeof sendMessage };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    console.log('测试3 (sendMessage):', test3);

    // 检查window对象
    const windowProps = await page.evaluate(() => {
      const funcs = [];
      for (let key in window) {
        if (key.includes('History') || key.includes('Message')) {
          funcs.push({ key, type: typeof window[key] });
        }
      }
      return funcs;
    });
    console.log('\nwindow中包含History/Message的属性:', windowProps);

    // 直接从script提取函数定义
    const script = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      return scripts[0]?.textContent || '';
    });

    // 查找loadHistory定义
    const loadHistStart = script.indexOf('function loadHistory(){');
    console.log('\nloadHistory定义位置:', loadHistStart);

    if (loadHistStart > 0) {
      // 提取函数
      let braceCount = 0;
      let started = false;
      let end = loadHistStart;
      for (let i = loadHistStart; i < script.length; i++) {
        if (script[i] === '{') {
          braceCount++;
          started = true;
        } else if (script[i] === '}') {
          braceCount--;
          if (started && braceCount === 0) {
            end = i + 1;
            break;
          }
        }
      }

      const funcCode = script.substring(loadHistStart, end);
      console.log('提取的函数长度:', funcCode.length);

      // 尝试执行
      const test4 = await page.evaluate((code) => {
        try {
          eval(code);
          return { success: true, result: typeof loadHistory };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, funcCode);
      console.log('测试4 (提取的loadHistory):', test4);
    }

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);