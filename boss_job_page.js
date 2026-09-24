#!/usr/bin/env node
/**
 * 使用 Playwright + Stealth 模式 + 移动端设备模拟访问 Boss 直聘职位详情页
 *
 * 用法:
 *   node boss_job_page.js                    # 默认访问目标链接
 *   node boss_job_page.js <url>            # 指定URL
 *
 * 依赖:
 *   npm install playwright
 */

const { chromium } = require('playwright');

const DEFAULT_URL = 'https://m.zhipin.com/mpa/html/weijd/weijd-job/6f17ed7fc04904401HR629S4ElRS?date8=20260503&sid=tosee_jd_1725a0a2a76f180c1HB53d21GVI~&openWeapp=1&fromSource=2';

/**
 * 应用 Stealth 模式 - 绕过自动化检测
 */
async function applyStealth(page) {
  // 1. 移除 webdriver 属性
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });
  });

  // 2. 修改 navigator.plugins
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
  });

  // 3. 修改 languages
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en']
    });
  });

  // 4. 修改 permissions
  await page.addInitScript(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  // 5. 模拟 chrome 运行时
  await page.addInitScript(() => {
    window.chrome = { runtime: {} };
  });

  // 6. 模拟 hardware concurrency 和 device memory
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8
    });
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8
    });
  });

  // 7. 移除自动化特征
  await page.addInitScript(() => {
    // 移除 chrome 对象
    delete window.chrome;
  });
}

async function main() {
  const url = process.argv[2] || DEFAULT_URL;
  console.log(`\n正在访问: ${url}\n`);

  // 使用 full chromium 而非 headless shell
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-infobars',
      '--disable-extensions',
      '--disable-popup-blocking'
    ]
  });

  // 创建移动端上下文
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    }
  });

  // 拦截所有请求以便调试
  // await context.route('**', async route => {
  //   console.log('请求:', route.request().url());
  //   await route.continue();
  // });

  const page = await context.newPage();

  // 阻止自动化检测脚本
  await page.addInitScript(() => {
    // 拦截 console 方法
    const originalConsoleMethod = console.error;
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('automation')) {
        return;
      }
      originalConsoleMethod.apply(console, args);
    };
  });

  // 应用 Stealth 模式
  await applyStealth(page);

  // 监听控制台消息
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('控制台错误:', msg.text());
    }
  });

  // 监听页面跳转
  page.on('framenavigated', frame => {
    console.log('页面跳转:', frame.url());
  });

  try {
    // 访问页面，增加重试逻辑
    console.log('正在加载页面...');

    let response = null;
    for (let i = 0; i < 3; i++) {
      try {
        response = await page.goto(url, {
          timeout: 30000,
          waitUntil: 'domcontentloaded'
        });
        console.log(`响应状态: ${response ? response.status() : '无响应'}`);
        break;
      } catch (e) {
        console.log(`第 ${i + 1} 次尝试失败: ${e.message}`);
        if (i < 2) await page.waitForTimeout(2000);
      }
    }

    // 等待一段时间让页面稳定
    await page.waitForTimeout(3000);

    // 截图
    const screenshotPath = '/tmp/boss_job_page.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`截图已保存到: ${screenshotPath}`);

    // 获取页面标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);

    // 检测是否被拦截
    const currentUrl = page.url();
    console.log(`当前URL: ${currentUrl}`);

    if (currentUrl.includes('verify') || currentUrl.includes('captcha') || currentUrl.includes('login')) {
      console.log('\n⚠️ 页面被重定向到验证/登录页');
      await handleVerifyPage(page);
    } else if (title === '' || currentUrl === 'about:blank') {
      console.log('\n⚠️ 页面内容为空，尝试其他方式...');
      await retryWithNewContext(url);
    } else {
      console.log('\n✅ 成功访问目标页面');

      // 获取页面内容长度
      const content = await page.content();
      console.log(`页面内容长度: ${content.length} 字符`);

      // 尝试提取关键信息
      await extractJobInfo(page);
    }

  } catch (e) {
    console.error('访问页面失败:', e.message);
  }

  await browser.close();
  console.log('\n浏览器已关闭');
}

/**
 * 处理验证页面
 */
async function handleVerifyPage(page) {
  console.log('\n--- 验证页处理 ---');

  // 获取验证页内容
  const text = await page.$eval('body', el => el.innerText).catch(() => '');
  console.log('页面内容:', text.substring(0, 500));

  // 尝试查找滑块验证
  const slider = await page.$('[class*="slider"], [class*="drag"], .verify-slider');
  if (slider) {
    console.log('发现滑块验证元素');
  }

  // 截图保存
  await page.screenshot({ path: '/tmp/verify_page.png', fullPage: true });
  console.log('验证页截图已保存到: /tmp/verify_page.png');
}

/**
 * 提取职位信息
 */
async function extractJobInfo(page) {
  console.log('\n--- 职位信息 ---');

  try {
    // 职位名称
    const selectors = [
      '.job-title',
      '.job-name',
      '.info-title',
      'h1',
      '[class*="title"]',
      '.position-title',
      '.detail-title'
    ];
    for (const sel of selectors) {
      const el = await page.$(sel);
      if (el) {
        const text = await el.textContent();
        if (text && text.trim()) {
          console.log(`职位名称: ${text.trim()}`);
          break;
        }
      }
    }
  } catch (e) {
    console.log('提取职位名称失败');
  }

  try {
    // 薪资范围
    const salarySelectors = [
      '.salary',
      '[class*="salary"]',
      '.info-salary',
      '.job-salary',
      '.boss-salary'
    ];
    for (const sel of salarySelectors) {
      const el = await page.$(sel);
      if (el) {
        const text = await el.textContent();
        if (text && text.trim()) {
          console.log(`薪资: ${text.trim()}`);
          break;
        }
      }
    }
  } catch (e) {
    console.log('提取薪资失败');
  }

  try {
    // 公司名称
    const companySelectors = [
      '.company-name',
      '[class*="company"]',
      '.info-company',
      '.boss-name'
    ];
    for (const sel of companySelectors) {
      const el = await page.$(sel);
      if (el) {
        const text = await el.textContent();
        if (text && text.trim()) {
          console.log(`公司名称: ${text.trim()}`);
          break;
        }
      }
    }
  } catch (e) {
    console.log('提取公司名称失败');
  }

  try {
    // 职位描述
    const descSelectors = [
      '.job-desc',
      '.description',
      '[class*="desc"]',
      '.info-desc',
      '.job-detail',
      '.detail-content'
    ];
    for (const sel of descSelectors) {
      const el = await page.$(sel);
      if (el) {
        const text = await el.textContent();
        if (text && text.trim()) {
          const shortText = text.trim().substring(0, 300);
          console.log(`职位描述: ${shortText}${text.length > 300 ? '...' : ''}`);
          break;
        }
      }
    }
  } catch (e) {
    console.log('提取职位描述失败');
  }

  // 输出页面HTML片段用于调试
  console.log('\n--- 页面HTML片段 ---');
  const body = await page.$eval('body', el => el.innerHTML).catch(() => '');
  console.log(body.substring(0, 2000));
}

/**
 * 使用新的 context 重试
 */
async function retryWithNewContext(url) {
  console.log('\n正在使用新的浏览器配置重试...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai'
  });

  const page = await context.newPage();

  // 更强的 stealth 脚本
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh'] });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
  });

  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const title = await page.title();
    console.log(`重试 - 页面标题: ${title}`);
    console.log(`重试 - 当前URL: ${page.url()}`);

    if (title || page.url() !== 'about:blank') {
      await page.screenshot({ path: '/tmp/boss_job_retry.png', fullPage: true });
      console.log('重试截图已保存到: /tmp/boss_job_retry.png');
      await extractJobInfo(page);
    } else {
      console.log('重试仍然失败，页面为空');
    }
  } catch (e) {
    console.error('重试失败:', e.message);
  }

  await browser.close();
}

main().catch(console.error);