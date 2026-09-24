#!/usr/bin/env node
/**
 * Playwright端到端测试 - 验证所有已知bug
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8082';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPage() {
  console.log('=== Playwright 端到端测试 - Bug验证 ===\n');

  let browser;
  let allPassed = true;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 收集控制台错误
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // 1. 访问页面
    console.log('【1. 访问页面】');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    console.log('  ✓ 页面加载完成\n');

    // 2. 切换到AI助手tab
    console.log('【2. 切换到AI助手tab】');
    const aiTab = await page.locator('button[data-tab="AI助手"]');
    await aiTab.click();
    await sleep(500);
    console.log('  ✓ 切换完成\n');

    // 3. 检查历史记录区域
    console.log('【3. 检查历史记录】');
    const historySection = await page.locator('#history-section');
    const historyExists = await historySection.count() > 0;
    console.log(`  历史记录区域存在: ${historyExists ? '✓' : '✗'}`);

    const historyList = await page.locator('#history-list');
    const historyListExists = await historyList.count() > 0;
    console.log(`  历史记录列表存在: ${historyListExists ? '✓' : '✗'}`);

    // 获取历史记录数量
    if (historyListExists) {
      const historyItems = await historyList.locator('.history-item').count();
      console.log(`  历史记录数量: ${historyItems}`);
    }
    console.log('');

    // 4. 检查tmpfile显示区域
    console.log('【4. 检查tmpfile显示区域】');
    const tmpfileSection = await page.locator('#tmpfile-section');
    const tmpfileExists = await tmpfileSection.count() > 0;
    console.log(`  tmpfile区域存在: ${tmpfileExists ? '✓' : '✗'}`);

    const tmpfileContent = await page.locator('#tmpfile-content');
    const tmpfileContentExists = await tmpfileContent.count() > 0;
    console.log(`  tmpfile内容区域存在: ${tmpfileContentExists ? '✓' : '✗'}`);

    // 检查tmpfile初始内容
    if (tmpfileContentExists) {
      const content = await tmpfileContent.textContent();
      console.log(`  tmpfile当前内容: ${content ? content.substring(0, 50) + '...' : '(空)'}`);
    }
    console.log('');

    // 5. 检查发送按钮
    console.log('【5. 检查发送按钮】');
    const sendBtn = await page.locator('#send-btn');
    const sendBtnExists = await sendBtn.count() > 0;
    console.log(`  发送按钮存在: ${sendBtnExists ? '✓' : '✗'}`);

    if (sendBtnExists) {
      const isDisabled = await sendBtn.isDisabled();
      console.log(`  发送按钮初始状态: ${isDisabled ? '禁用' : '启用'}`);

      // 检查按钮是否有onclick事件
      const onclickAttr = await sendBtn.getAttribute('onclick');
      console.log(`  发送按钮onclick属性: ${onclickAttr || '(无)'}`);

      // 检查按钮是否有事件监听器
      const hasListeners = await page.evaluate(() => {
        const btn = document.getElementById('send-btn');
        if (!btn) return false;
        // 检查onclick属性或addEventListener
        return btn.getAttribute('onclick') !== null ||
               (btn.onclick !== null) ||
               btn.hasEventListeners;
      });
      console.log(`  发送按钮有事件绑定: ${hasListeners ? '✓' : '✗'}`);
    }
    console.log('');

    // 6. 检查聊天输入框
    console.log('【6. 检查聊天输入框】');
    const chatInput = await page.locator('#chat-input');
    const chatInputExists = await chatInput.count() > 0;
    console.log(`  输入框存在: ${chatInputExists ? '✓' : '✗'}`);

    if (chatInputExists) {
      // 输入测试文本
      await chatInput.fill('测试消息');
      const inputValue = await chatInput.inputValue();
      console.log(`  输入测试文本成功: ${inputValue === '测试消息' ? '✓' : '✗'}`);
    }
    console.log('');

    // 7. 测试发送按钮点击
    console.log('【7. 测试发送按钮点击】');
    const sendBtnBefore = await page.locator('#send-btn');
    const disabledBefore = await sendBtnBefore.isDisabled();
    console.log(`  点击前按钮状态: ${disabledBefore ? '禁用' : '启用'}`);

    // 点击发送按钮
    try {
      await sendBtnBefore.click({ timeout: 5000 });
      console.log('  点击发送按钮: ✓');

      // 等待一下
      await sleep(1000);

      // 检查按钮状态变化
      const disabledAfter = await sendBtnBefore.isDisabled();
      console.log(`  点击后按钮状态: ${disabledAfter ? '禁用(加载中)' : '启用(完成或失败)'}`);
    } catch (e) {
      console.log(`  点击发送按钮失败: ✗ - ${e.message}`);
      allPassed = false;
    }
    console.log('');

    // 8. 检查JavaScript代码中的问题
    console.log('【8. 检查JavaScript代码】');
    const html = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8');

    // 检查sendMessage函数
    const sendMsgMatch = html.match(/async function sendMessage\(\)[\s\S]*?^  '\}'/m);
    if (sendMsgMatch) {
      const code = sendMsgMatch[0];

      // 检查startTmpFilePolling调用次数
      const pollingCount = (code.match(/startTmpFilePolling\(\)/g) || []).length;
      console.log(`  startTmpFilePolling调用次数: ${pollingCount} ${pollingCount === 1 ? '✓' : '✗ (应为1)'}`);
      if (pollingCount !== 1) allPassed = false;

      // 检查response变量作用域
      if (code.includes('var response=null')) {
        console.log('  response变量外层声明: ✓');
      } else if (code.match(/var response\s*=\s*await fetch/)) {
        console.log('  response变量在内部声明: ✗ (应移到外层)');
        allPassed = false;
      }

      // 检查finally块
      if (code.includes('finally')) {
        if (code.includes('setLoading(false)')) {
          console.log('  finally块包含setLoading(false): ✓');
        } else {
          console.log('  finally块缺少setLoading(false): ✗');
          allPassed = false;
        }

        if (code.includes('loadHistory()')) {
          console.log('  finally块包含loadHistory(): ✓');
        } else {
          console.log('  finally块缺少loadHistory(): ✗');
          allPassed = false;
        }
      }
    } else {
      console.log('  sendMessage函数未找到: ✗');
      allPassed = false;
    }
    console.log('');

    // 9. 检查服务器静态文件路由
    console.log('【9. 检查服务器静态文件路由】');
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`${BASE_URL}/uploads/test.txt`, resolve).on('error', reject);
      });
      console.log(`  /uploads/路由状态: ${res.statusCode} ${res.statusCode === 200 || res.statusCode === 404 ? '✓' : '✗'}`);
    } catch (e) {
      console.log(`  /uploads/路由错误: ✗ - ${e.message}`);
      allPassed = false;
    }
    console.log('');

    // 10. 检查控制台错误
    console.log('【10. 检查控制台错误】');
    if (errors.length === 0) {
      console.log('  无控制台错误: ✓');
    } else {
      console.log(`  发现 ${errors.length} 个控制台错误:`);
      errors.forEach((err, i) => console.log(`    ${i + 1}. ${err}`));
      allPassed = false;
    }
    console.log('');

    // 总结
    console.log('='.repeat(50));
    if (allPassed) {
      console.log('✓ 所有检查通过');
    } else {
      console.log('✗ 存在未通过的检查');
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('测试错误:', error.message);
    allPassed = false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return allPassed;
}

testPage().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error(err);
  process.exit(1);
});