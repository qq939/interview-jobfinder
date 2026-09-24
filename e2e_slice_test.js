#!/usr/bin/env node
/**
 * 分片测试 - 定位JavaScript错误
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 分片测试 - 定位JavaScript错误 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`[Page Error] ${error.message}`);
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // 获取script内容
    const script = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      return scripts[0]?.textContent || '';
    });

    // 分割script为多个部分并逐个执行
    const parts = [
      { name: 'part1 (0-2000)', start: 0, end: 2000 },
      { name: 'part2 (2000-4000)', start: 2000, end: 4000 },
      { name: 'part3 (4000-6000)', start: 4000, end: 6000 },
      { name: 'part4 (6000-end)', start: 6000, end: script.length }
    ];

    for (const part of parts) {
      console.log(`\n测试 ${part.name}...`);
      try {
        // 创建一个新的函数来执行这段代码
        await page.evaluate((code) => {
          try {
            eval(code);
          } catch (e) {
            console.error('eval error:', e.message);
          }
        }, script.substring(part.start, part.end));

        // 检查全局函数
        const funcs = await page.evaluate(() => {
          return {
            addMessage: typeof addMessage,
            setLoading: typeof setLoading,
            sendMessage: typeof sendMessage,
            loadHistory: typeof loadHistory
          };
        });
        console.log(`  函数状态:`, funcs);
      } catch (e) {
        console.log(`  执行失败: ${e.message}`);
      }
    }

    // 检查chatInput是否存在
    const chatInputExists = await page.evaluate(() => {
      return typeof chatInput !== 'undefined' && chatInput !== null;
    });
    console.log(`\nchatInput存在: ${chatInputExists}`);

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);