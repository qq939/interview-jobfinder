#!/usr/bin/env node
/**
 * 检查全局作用域
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 检查全局作用域 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`[Page Error] ${error.message}`);
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 检查全局变量
    const globals = await page.evaluate(() => {
      const result = {};
      // 检查全局作用域
      result['typeof window.loadHistory'] = typeof window.loadHistory;
      result['typeof window.sendMessage'] = typeof window.sendMessage;
      result['typeof loadHistory'] = typeof loadHistory;

      // 检查是否是全局this
      result['typeof this.loadHistory'] = typeof this?.loadHistory;

      // 检查所有定义的函数
      const allFuncs = Object.keys(window).filter(k => typeof window[k] === 'function' && k.length < 30);
      result['函数数量'] = allFuncs.length;

      return result;
    });

    console.log('全局变量检查:');
    console.log(JSON.stringify(globals, null, 2));

    // 尝试通过window访问
    const viaWindow = await page.evaluate(() => {
      return {
        loadHistory: typeof window.loadHistory,
        sendMessage: typeof window.sendMessage,
        showDialog: typeof window.showDialog
      };
    });
    console.log('\n通过window访问:');
    console.log(JSON.stringify(viaWindow, null, 2));

    // 检查script执行后是否有新的属性被添加
    const newProps = await page.evaluate(() => {
      const knownProps = ['addEventListener', 'setTimeout', 'fetch', 'document', 'window'];
      const newOnes = [];
      for (let key in window) {
        if (!knownProps.includes(key) && typeof window[key] === 'function') {
          newOnes.push(key);
        }
      }
      return newOnes.slice(0, 50);
    });
    console.log('\nscript添加的新函数(前50个):');
    console.log(newOnes);

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);