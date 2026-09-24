#!/usr/bin/env node
/**
 * 完整的功能测试 - 模拟真实用户操作
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== 完整功能测试 ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // 1. 访问页面
    console.log('【1】访问页面');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    console.log('  ✓ 页面加载完成\n');

    // 2. 切换到AI助手tab
    console.log('【2】切换到AI助手tab');
    await page.click('button[data-tab="AI助手"]');
    await sleep(500);
    console.log('  ✓ 切换成功\n');

    // 3. 检查欢迎消息
    console.log('【3】检查欢迎消息');
    const welcomeMsg = await page.locator('.message-ai').first();
    const hasWelcome = await welcomeMsg.count() > 0;
    console.log(`  欢迎消息存在: ${hasWelcome ? '✓' : '✗'}`);
    if (hasWelcome) {
      const text = await welcomeMsg.locator('.message-content').textContent();
      console.log(`  欢迎消息内容: ${text.substring(0, 50)}...`);
    }
    console.log('');

    // 4. 检查历史记录加载
    console.log('【4】检查历史记录加载');
    await sleep(1000);

    // 检查API响应
    const dialogsRes = await page.request.get(`${BASE_URL}/api/dialogs`);
    const dialogsData = await dialogsRes.json();
    console.log(`  /api/dialogs 返回: ${dialogsData.dialogs?.length || 0} 条对话`);

    // 检查历史记录UI
    const historyItems = await page.locator('#history-list .history-item').count();
    console.log(`  历史记录UI项目数: ${historyItems}`);
    console.log('');

    // 5. 检查发送按钮状态
    console.log('【5】检查发送按钮');
    const sendBtn = page.locator('#send-btn');
    const isDisabled = await sendBtn.isDisabled();
    console.log(`  按钮初始状态: ${isDisabled ? '禁用' : '启用'}`);
    console.log(`  onclick属性: ${await sendBtn.getAttribute('onclick')}`);
    console.log('');

    // 6. 输入消息并发送
    console.log('【6】发送消息测试');
    const chatInput = page.locator('#chat-input');

    // 清空并输入
    await chatInput.fill('');
    await chatInput.fill('你好，这是一个测试消息');

    const inputVal = await chatInput.inputValue();
    console.log(`  输入内容: ${inputVal}`);

    // 点击发送按钮
    console.log('  点击发送按钮...');
    await sendBtn.click();

    // 检查按钮状态变化
    await sleep(500);
    const isDisabledAfter = await sendBtn.isDisabled();
    console.log(`  点击后按钮状态: ${isDisabledAfter ? '禁用(请求中)' : '启用(完成或失败)'}`);

    // 检查用户消息是否显示
    await sleep(1000);
    const userMessages = await page.locator('.message-user');
    const userMsgCount = await userMessages.count();
    console.log(`  用户消息显示: ${userMsgCount > 0 ? `✓ (${userMsgCount}条)` : '✗'}`);
    console.log('');

    // 7. 检查tmpfile轮询
    console.log('【7】检查tmpfile轮询');
    const tmpfileSection = page.locator('#tmpfile-section');
    const tmpfileDisplay = await tmpfileSection.evaluate(el => getComputedStyle(el).display);
    console.log(`  tmpfile区域显示状态: ${tmpfileDisplay}`);
    console.log('');

    // 8. 检查服务器tmpfile文件
    console.log('【8】检查服务器tmpfile文件');
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`${BASE_URL}/uploads/tmpfile.txt`, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
      });
      console.log(`  tmpfile.txt 状态: ${res.status}`);
      if (res.status === 200) {
        console.log(`  tmpfile内容预览:\n${res.data.substring(0, 200)}...`);
      }
    } catch (e) {
      console.log(`  tmpfile请求错误: ${e.message}`);
    }
    console.log('');

    // 9. 检查loadHistory是否被调用
    console.log('【9】检查历史记录刷新');
    await sleep(2000);
    const historyItemsAfter = await page.locator('#history-list .history-item').count();
    console.log(`  历史记录项目数: ${historyItemsAfter}`);
    console.log('');

    // 10. 控制台错误
    console.log('【10】控制台错误检查');
    if (errors.length === 0) {
      console.log('  无控制台错误: ✓');
    } else {
      console.log(`  发现 ${errors.length} 个错误:`);
      errors.slice(0, 5).forEach((err, i) => console.log(`    ${i + 1}. ${err.substring(0, 100)}`));
    }
    console.log('');

    // 总结
    console.log('='.repeat(50));
    console.log('测试完成');
    console.log('='.repeat(50));

  } catch (e) {
    console.error('测试出错:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);