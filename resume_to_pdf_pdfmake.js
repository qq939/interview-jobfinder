#!/usr/bin/env node
// HTML 简历 → PDF（pdfmake + 中文字体）
// 用法: node resume_to_pdf_pdfmake.js <input.html> <output.pdf> [font.ttf]

const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake/js/printer').default;
const { virtualfs, urlAccessPolicy } = require('pdfmake');

const DEFAULT_FONT = '/home/agent/.claude/workspace/project/uploads/fonts/SimHei.ttf';

const inputHtml = process.argv[2] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-11.html';
const outputPdf = process.argv[3] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-14.pdf';
const fontPath = process.argv[4] || DEFAULT_FONT;

if (!fs.existsSync(inputHtml)) { console.error('HTML 不存在:', inputHtml); process.exit(1); }
if (!fs.existsSync(fontPath)) { console.error('字体不存在:', fontPath); process.exit(1); }

const fontBuffer = fs.readFileSync(fontPath);
const fonts = {
    zh: {
        normal: fontBuffer,
        bold: fontBuffer,
        italics: fontBuffer,
        bolditalics: fontBuffer
    }
};
const printer = new PdfPrinter(fonts, virtualfs, urlAccessPolicy);

// 解析 HTML
function htmlToBlocks(html) {
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    const nameMatch = html.match(/<h1[^>]*class="name"[^>]*>(.*?)<\/h1>/i);
    const name = nameMatch ? stripTags(nameMatch[1]).trim() : '简历';
    const sectionRe = /<section[^>]*>([\s\S]*?)<\/section>/gi;
    const sections = [];
    let m;
    while ((m = sectionRe.exec(html)) !== null) {
        const sec = m[1];
        const titleMatch = sec.match(/<h2[^>]*>(.*?)<\/h2>/i);
        const title = titleMatch ? stripTags(titleMatch[1]).replace(/\s+/g, '').trim() : '';
        let body = sec.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '');
        body = body.replace(/<br\s*\/?>/gi, '\n');
        body = body.replace(/<\/li>/gi, '\n');
        body = body.replace(/<li[^>]*>/gi, '• ');
        body = body.replace(/<\/p>/gi, '\n');
        body = body.replace(/<\/div>/gi, '\n');
        body = stripTags(body);
        body = body.split('\n').map(l => l.trim()).filter(l => l).join('\n');
        if (title) sections.push({ title, body });
    }
    return { name, sections };
}

function stripTags(s) {
    return s.replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
}

const blocks = htmlToBlocks(fs.readFileSync(inputHtml, 'utf8'));
console.log('提取:', blocks.name, '| sections:', blocks.sections.length);

// 构造 pdfmake docDefinition
const content = [];
content.push({ text: blocks.name, fontSize: 24, bold: true, alignment: 'center', margin: [0, 0, 0, 4] });
content.push({ text: '信息安全工程师 · 简历', fontSize: 11, color: '#666', alignment: 'center', margin: [0, 0, 0, 12] });
content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 1.5, lineColor: '#e31837' }], margin: [0, 0, 0, 16] });

for (const sec of blocks.sections) {
    content.push({ text: sec.title, fontSize: 14, bold: true, color: '#e31837', margin: [0, 8, 0, 6] });
    const lines = sec.body.split('\n').map(l => ({ text: l, fontSize: 10.5, lineHeight: 1.5 }));
    content.push(...lines);
}

const docDefinition = {
    defaultStyle: { font: 'zh' },
    content,
    pageSize: 'A4',
    pageMargins: [50, 50, 50, 50]
};

(async () => {
    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    pdfDoc.pipe(fs.createWriteStream(outputPdf));
    pdfDoc.end();
    pdfDoc.on('end', () => {
        const stat = fs.statSync(outputPdf);
        console.log('PDF 已生成:', outputPdf, '(' + (stat.size / 1024).toFixed(1) + ' KB)');
    });
})();
