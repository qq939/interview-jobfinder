#!/usr/bin/env node
// 用 Playwright + Chromium 把 HTML 简历转 PDF
// 用法: node html_to_pdf.js <input.html> <output.pdf>

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
    const inputHtml = process.argv[2] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-11.html';
    const outputPdf = process.argv[3] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-14.pdf';

    if (!fs.existsSync(inputHtml)) {
        console.error('输入 HTML 不存在:', inputHtml);
        process.exit(1);
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const fileUrl = 'file://' + path.resolve(inputHtml);
    console.log('打开:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    await page.pdf({
        path: outputPdf,
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });

    await browser.close();

    const stat = fs.statSync(outputPdf);
    console.log('PDF 已生成:', outputPdf, '(' + (stat.size / 1024).toFixed(1) + ' KB)');
})().catch((e) => { console.error('失败:', e); process.exit(1); });
