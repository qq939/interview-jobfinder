#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BOSS直聘岗位信息挖掘脚本
使用 Playwright + Stealth 模式绕过反爬检测

依赖安装：
    pip install playwright
    playwright install chromium

用法：
    python boss_job_scraper.py [岗位URL]

示例：
    python boss_job_scraper.py "https://www.zhipin.com/job_detail/7dd297c4cdb376d103Rz0t27FldZ.html"
"""

import asyncio
import json
import re
import sys
import time
from pathlib import Path
from typing import Optional, Dict, List

try:
    from playwright.async_api import async_playwright, Browser, Page, BrowserContext
except ImportError:
    print("请先安装 playwright: pip install playwright && playwright install chromium")
    sys.exit(1)


class BossJobScraper:
    """BOSS直聘岗位信息挖掘器"""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

        # Stealth 模式配置
        self.stealth_script = """
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        """

    async def init_browser(self):
        """初始化浏览器（Stealth 模式）"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-plugins',
            ]
        )

        # 创建移动端视口（模拟手机访问）
        self.context = await self.browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
            is_mobile=True,
            has_touch=True,
            extra_http_headers={
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            }
        )

        self.page = await self.context.new_page()

        # 应用 Stealth 脚本
        await self.page.add_init_script(self.stealth_script)

        return self

    async def close(self):
        """关闭浏览器"""
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()

    async def check_verification(self) -> bool:
        """检测是否跳转到验证页面"""
        url = self.page.url
        if 'verify' in url or 'captcha' in url:
            print("⚠️  检测到滑块验证页面，需要手动处理")
            await self.page.screenshot(path='/tmp/boss_verify.png')
            return True
        return False

    async def extract_job_info(self, url: str) -> Optional[Dict]:
        """提取岗位信息"""
        print(f"📥 正在访问: {url}")

        try:
            await self.page.goto(url, timeout=30000, wait_until='networkidle')
            await asyncio.sleep(3)  # 等待页面完全加载

            # 检测验证页面
            if await self.check_verification():
                return None

            # 等待页面内容加载
            await asyncio.sleep(2)

            # 截图保存
            await self.page.screenshot(path='/tmp/boss_job_detail.png', full_page=True)
            print("📸 页面已截图保存到 /tmp/boss_job_detail.png")

            # 提取岗位信息
            job_info = {
                'url': url,
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'extract_status': 'success',
            }

            # 尝试多种选择器提取信息
            job_info['title'] = await self._extract_text([
                '.job-title h1',
                '.job-detail .title',
                'h1.name',
                '[class*="title"] h1',
            ])

            job_info['company'] = await self._extract_text([
                '.company-name',
                '.info-company .name',
                '[class*="company"] a',
                '.job-detail .company',
            ])

            job_info['salary'] = await self._extract_text([
                '.salary',
                '.job-salary',
                '[class*="salary"]',
                '.info-primary .salary',
            ])

            job_info['location'] = await self._extract_text([
                '.location-address',
                '.job-location',
                '[class*="location"]',
                '.info-primary .location',
            ])

            job_info['experience'] = await self._extract_text([
                '.job-tags .tag:has-text("经验")',
                '[class*="experience"]',
                '.info-primary .exp',
            ])

            job_info['education'] = await self._extract_text([
                '.job-tags .tag:has-text("学历")',
                '[class*="education"]',
                '.info-primary .edu',
            ])

            job_info['job_detail'] = await self._extract_text([
                '.job-detail',
                '[class*="description"]',
                '.content .text',
            ])

            # 提取技能标签
            job_info['tags'] = await self._extract_tags([
                '.tag-list .tag',
                '.job-tags span',
                '[class*="tag"]',
            ])

            # 提取公司信息
            job_info['company_info'] = await self._extract_company_info()

            return job_info

        except Exception as e:
            print(f"❌ 提取失败: {str(e)}")
            return {
                'url': url,
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'extract_status': 'failed',
                'error': str(e)
            }

    async def _extract_text(self, selectors: List[str]) -> Optional[str]:
        """尝试多个选择器提取文本"""
        for selector in selectors:
            try:
                element = await self.page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    if text and text.strip():
                        return text.strip()
            except:
                continue
        return None

    async def _extract_tags(self, selectors: List[str]) -> List[str]:
        """提取标签列表"""
        tags = []
        for selector in selectors:
            try:
                elements = await self.page.query_selector_all(selector)
                for el in elements:
                    text = await el.inner_text()
                    if text and text.strip() and text.strip() not in tags:
                        tags.append(text.strip())
            except:
                continue
        return tags

    async def _extract_company_info(self) -> Optional[Dict]:
        """提取公司信息"""
        company_info = {}

        selectors = {
            'name': ['.company-name', '[class*="company"] .name'],
            'size': ['.company-size', '[class*="size"]', '[class*="staff"]'],
            'industry': ['.company-industry', '[class*="industry"]'],
        }

        for key, selector_list in selectors.items():
            company_info[key] = await self._extract_text(selector_list)

        return company_info if any(company_info.values()) else None

    async def search_jobs(self, keyword: str, city: str = '全国', page: int = 1) -> List[Dict]:
        """搜索岗位列表"""
        search_url = f"https://www.zhipin.com/web/geek/job?query={keyword}&city={city}&page={page}"
        print(f"🔍 搜索关键词: {keyword} (第{page}页)")

        jobs = []

        try:
            await self.page.goto(search_url, timeout=30000, wait_until='networkidle')
            await asyncio.sleep(3)

            if await self.check_verification():
                return jobs

            # 截图
            await self.page.screenshot(path='/tmp/boss_search.png', full_page=True)

            # 提取岗位列表
            job_cards = await self.page.query_selector_all('.job-card-box')

            for card in job_cards:
                try:
                    job = {}

                    # 提取基本信息
                    title_el = await card.query_selector('.job-title')
                    if title_el:
                        job['title'] = await title_el.inner_text()

                    company_el = await card.query_selector('.company-name')
                    if company_el:
                        job['company'] = await company_el.inner_text()

                    salary_el = await card.query_selector('.salary')
                    if salary_el:
                        job['salary'] = await salary_el.inner_text()

                    link_el = await card.query_selector('a')
                    if link_el:
                        href = await link_el.get_attribute('href')
                        if href:
                            job['url'] = f"https://www.zhipin.com{href}"

                    jobs.append(job)
                except Exception as e:
                    print(f"  ⚠️ 提取单条岗位失败: {e}")
                    continue

            print(f"✅ 找到 {len(jobs)} 个岗位")

        except Exception as e:
            print(f"❌ 搜索失败: {str(e)}")

        return jobs


async def main():
    """主函数"""
    # 默认测试URL
    default_url = "https://www.zhipin.com/job_detail/7dd297c4cdb376d103Rz0t27FldZ.html"

    # 从命令行参数获取URL
    url = sys.argv[1] if len(sys.argv) > 1 else default_url

    print("=" * 60)
    print("BOSS直聘岗位信息挖掘器")
    print("=" * 60)

    scraper = BossJobScraper(headless=True)

    try:
        await scraper.init_browser()
        print("✅ 浏览器启动成功")

        # 提取单个岗位信息
        job_info = await scraper.extract_job_info(url)

        if job_info:
            print("\n" + "=" * 60)
            print("岗位信息")
            print("=" * 60)

            for key, value in job_info.items():
                if value:
                    if key == 'tags' and isinstance(value, list):
                        print(f"{key}: {', '.join(value)}")
                    elif key == 'company_info' and isinstance(value, dict):
                        print(f"{key}:")
                        for ck, cv in value.items():
                            if cv:
                                print(f"  - {ck}: {cv}")
                    else:
                        print(f"{key}: {value}")

            # 保存到文件
            output_file = '/home/agent/.claude/workspace/project/uploads/boss_job_info.json'
            Path(output_file).parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(job_info, f, ensure_ascii=False, indent=2)

            print(f"\n💾 信息已保存到: {output_file}")
        else:
            print("❌ 无法提取岗位信息，可能遇到验证页面")

    finally:
        await scraper.close()
        print("\n👋 浏览器已关闭")


async def batch_scrape():
    """批量挖掘多个岗位"""
    urls = [
        "https://www.zhipin.com/job_detail/7dd297c4cdb376d103Rz0t27FldZ.html",
    ]

    scraper = BossJobScraper(headless=True)

    try:
        await scraper.init_browser()

        results = []
        for url in urls:
            job_info = await scraper.extract_job_info(url)
            if job_info:
                results.append(job_info)
            await asyncio.sleep(2)  # 避免请求过快

        # 保存批量结果
        output_file = '/home/agent/.claude/workspace/project/uploads/boss_jobs_batch.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"\n💾 批量结果已保存到: {output_file}")

    finally:
        await scraper.close()


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--batch':
        asyncio.run(batch_scrape())
    else:
        asyncio.run(main())