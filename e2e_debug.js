#!/usr/bin/env node
/**
 * 详细调试测试
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

async function main() {
  console.log('=== 详细调试测试 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 切换到AI助手tab
    await page.click('button[data-tab="AI助手"]');
    await page.waitForTimeout(1000);

    // 检查所有元素
    console.log('【元素检查】');

    // 检查chat-messages
    const chatMsgs = await page.locator('#chat-messages').count();
    console.log(`#chat-messages: ${chatMsgs}`);

    // 检查所有.message
    const allMessages = await page.locator('.message').count();
    console.log(`所有.message元素: ${allMessages}`);

    // 检查.message-ai
    const aiMessages = await page.locator('.message-ai').count();
    console.log(`.message-ai元素: ${aiMessages}`);

    // 检查.message-user
    const userMessages = await page.locator('.message-user').count();
    console.log(`.message-user元素: ${userMessages}`);

    // 检查#history-list
    const historyList = await page.locator('#history-list').count();
    console.log(`#history-list: ${historyList}`);

    // 检查#history-list内的元素
    const historyItems = await page.locator('#history-list > div').count();
    console.log(`#history-list > div (历史项): ${historyItems}`);

    // 打印chat-messages的innerHTML
    const chatMsgsHtml = await page.locator('#chat-messages').innerHTML();
    console.log(`\n#chat-messages innerHTML:\n${chatMsgsHtml.substring(0, 500)}`);

    // 打印history-list的innerHTML
    const historyHtml = await page.locator('#history-list').innerHTML();
    console.log(`\n#history-list innerHTML:\n${historyHtml.substring(0, 500)}`);

    // 截图
    await page.screenshot({ path: '/tmp/debug_screenshot.png', fullPage: true });
    console.log('\n截图保存到 /tmp/debug_screenshot.png');

    // 检查JavaScript函数是否定义
    console.log('\n【JavaScript函数检查】');
    const funcs = await page.evaluate(() => {
      return {
        sendMessage: typeof sendMessage === 'function',
        loadHistory: typeof loadHistory === 'function',
        addMessage: typeof addMessage === 'function',
        switchTab: typeof switchTab === 'function'
      };
    });
    console.log(funcs);

    // 手动调用addMessage测试
    console.log('\n【手动调用addMessage测试】');
    const result = await page.evaluate(() => {
      try {
        addMessage('ai', '测试消息');
        return {
          success: true,
          messageCount: document.querySelectorAll('.message').length
        };
      } catch (e) {
        return {
          success: false,
          error: e.message
        };
      }
    });
    console.log(result);

    // 检查添加后的chat-messages
    const chatMsgsHtmlAfter = await page.locator('#chat-messages').innerHTML();
    console.log(`\n添加后#chat-messages innerHTML:\n${chatMsgsHtmlAfter.substring(0, 500)}`);

  } catch (e) {
    console.error('测试错误:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);