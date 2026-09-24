#!/usr/bin/env node
// HTML 简历 → PDF 转换器（pdfkit + SimHei 中文字体）
// 用法: node resume_to_pdf.js <input.html> <output.pdf>

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_PATH = '/home/agent/.claude/workspace/project/uploads/fonts/SourceHanSansSC-Regular.otf';
const inputHtml = process.argv[2] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-11.html';
const outputPdf = process.argv[3] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-14.pdf';

if (!fs.existsSync(inputHtml)) {
    console.error('HTML 不存在:', inputHtml);
    process.exit(1);
}
if (!fs.existsSync(FONT_PATH)) {
    console.error('字体不存在:', FONT_PATH);
    process.exit(1);
}

// 简单 HTML → 文本提取（去标签，按 h1/h2/p 拆分）
function htmlToBlocks(html) {
    // 去除 <style> <script>
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // 提取 name
    const nameMatch = html.match(/<h1[^>]*class="name"[^>]*>(.*?)<\/h1>/i);
    const name = nameMatch ? stripTags(nameMatch[1]).trim() : '';
    // 提取 sections
    const sectionRe = /<section[^>]*>([\s\S]*?)<\/section>/gi;
    const sections = [];
    let m;
    while ((m = sectionRe.exec(html)) !== null) {
        const sec = m[1];
        const titleMatch = sec.match(/<h2[^>]*>(.*?)<\/h2>/i);
        const title = titleMatch ? stripTags(titleMatch[1]).replace(/\s+/g, '').trim() : '';
        // 提取内部文本（保留基本换行）
        let body = sec;
        body = body.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '');
        // 把 <br> <li> 转为换行
        body = body.replace(/<br\s*\/?>/gi, '\n');
        body = body.replace(/<\/li>/gi, '\n');
        body = body.replace(/<li[^>]*>/gi, '• ');
        // </p> 后换行
        body = body.replace(/<\/p>/gi, '\n');
        body = body.replace(/<\/div>/gi, '\n');
        // 去标签
        body = stripTags(body);
        // 清理多余空行
        body = body.split('\n').map(l => l.trim()).filter(l => l).join('\n');
        if (title) sections.push({ title, body });
    }
    return { name, sections };
}

function stripTags(s) {
    return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

// 生成 PDF
const blocks = htmlToBlocks(fs.readFileSync(inputHtml, 'utf8'));
console.log('提取到:', blocks.name, '| sections:', blocks.sections.length);

const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: { Title: blocks.name + ' - 简历', Author: blocks.name }
});

doc.pipe(fs.createWriteStream(outputPdf));
doc.registerFont('zh', FONT_PATH);
doc.font('zh');

const PAGE_WIDTH = doc.page.width - doc.page.margins.left - doc.page.margins.right;

// 标题：姓名
doc.fontSize(28).text(blocks.name, { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(12).fillColor('#666').text('信息安全工程师 · 简历', { align: 'center' });
doc.moveDown(0.8);
doc.fillColor('#000');

// 分割线
const dividerY = doc.y;
doc.moveTo(50, dividerY).lineTo(doc.page.width - 50, dividerY).strokeColor('#e31837').lineWidth(2).stroke();
doc.moveDown(1);

// 各 section
for (const sec of blocks.sections) {
    // 检查是否需要换页
    if (doc.y > doc.page.height - 120) doc.addPage();
    // 标题
    doc.fontSize(15).fillColor('#e31837').text(sec.title, { underline: false });
    doc.moveDown(0.4);
    // 内容
    doc.fontSize(11).fillColor('#1a1a1a');
    const lines = sec.body.split('\n');
    for (const line of lines) {
        if (doc.y > doc.page.height - 80) doc.addPage();
        doc.text(line, { width: PAGE_WIDTH, align: 'left', lineGap: 2 });
    }
    doc.moveDown(0.8);
}

doc.end();
doc.on('end', () => {
    const stat = fs.statSync(outputPdf);
    console.log('PDF 已生成:', outputPdf, '(' + (stat.size / 1024).toFixed(1) + ' KB)');
});
