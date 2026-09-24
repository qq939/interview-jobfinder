from playwright.sync_api import sync_playwright
from stealth import stealth_js  # 需要安装 playwright-stealth

def emulate_device():
    with sync_playwright() as p:
        # 启动 Chromium 并注入 stealth 脚本
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
            ]
        )

        # 创建移动端上下文 - 模拟 iPhone 12
        context = browser.new_context(
            **p.devices['iPhone 12'],
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
            permissions=['geolocation'],
            viewport={'width': 390, 'height': 844}
        )

        # 注入 stealth 脚本避免被检测
        page = context.new_page()
        page.add_init_script(stealth_js)

        # 设置 User-Agent
        page.set_extra_http_headers({
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        })

        try:
            # 访问目标 URL
            url = "https://m.zhipin.com/mpa/html/weijd/weijd-job/6f17ed7fc04904401HR629S4ElRS?date8=20260503&sid=tosee_jd_1725a0a2a76f180c1HB53d21GVI~&openWeapp=1&fromSource=2"
            print(f"正在访问: {url}")
            page.goto(url, wait_until='networkidle', timeout=30000)

            # 等待页面加载
            page.wait_for_timeout(3000)

            # 截图保存
            screenshot_path = '/tmp/zhipin_mobile.png'
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"截图已保存到: {screenshot_path}")

            # 获取页面内容用于调试
            title = page.title()
            print(f"页面标题: {title}")

            # 打印部分HTML用于调试
            content = page.content()
            print(f"页面内容长度: {len(content)} 字符")

            # 尝试提取关键信息
            try:
                # 等待主要容器加载
                page.wait_for_selector('.job-detail, .job-content, main, .main', timeout=10000)

                # 获取职位信息
                job_title = page.locator('h1, .job-title, .title').first.text_content() if page.locator('h1, .job-title, .title').count() > 0 else 'N/A'
                print(f"职位名称: {job_title}")

                company = page.locator('.company-name, .company, .name').first.text_content() if page.locator('.company-name, .company, .name').count() > 0 else 'N/A'
                print(f"公司名称: {company}")

                salary = page.locator('.salary, .job-salary').first.text_content() if page.locator('.salary, .job-salary').count() > 0 else 'N/A'
                print(f"薪资: {salary}")

            except Exception as e:
                print(f"提取信息时出错: {e}")

        except Exception as e:
            print(f"访问页面时出错: {e}")

        finally:
            browser.close()

if __name__ == '__main__':
    emulate_device()
