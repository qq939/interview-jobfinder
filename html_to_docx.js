#!/usr/bin/env node
/**
 * 简历 HTML → DOCX（docx-js）
 * 还原 HTML 设计：深色页眉、红色装饰条、红色 section 标题、红色高亮块。
 * 依赖：docx（本地安装于 ./.docx-deps/node_modules）
 * 用法：NODE_PATH=./.docx-deps/node_modules node html_to_docx.js <input.html> <output.docx>
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, ShadingType, TabStopType, TabStopPosition,
  Header, Footer,
} = require('docx');

// ----- 颜色 -----
const COLOR_RED = 'C00000';
const COLOR_DARK = '1A1A1A';
const COLOR_GRAY = '666666';
const COLOR_LIGHTGRAY = '999999';
const COLOR_WHITE = 'FFFFFF';
const COLOR_HIGHLIGHT_BG = 'FAFAFA';

// ----- 字体 -----
const ZH_FONT = 'Microsoft YaHei';

// ----- 工具：HTML 实体反转义 + 简单行内 <strong> 解析 -----
function decodeEntities(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).trim();
}
// 平衡 div 标签切片：从 start_pos 开始按 <div ... >/</div> 计数，找到外层 div 闭合位置
function balancedSlice(text, startPos) {
  let depth = 0;
  let i = startPos;
  const n = text.length;
  while (i < n) {
    if (text.startsWith('<div', i) && (text[i + 4] === ' ' || text[i + 4] === '>')) {
      depth++;
      const end = text.indexOf('>', i);
      i = end + 1;
      continue;
    }
    if (text.startsWith('</div>', i)) {
      depth--;
      i += 6;
      if (depth === 0) return text.slice(startPos, i);
      continue;
    }
    i++;
  }
  return text.slice(startPos);
}
// 抽取所有 class="<className>" 的 <div>...</div> 块（处理嵌套 div）
function extractDivBlocks(text, className) {
  const out = [];
  const re = new RegExp(`<div[^>]*class="${className}"[^>]*>`, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push(balancedSlice(text, m.index));
  }
  return out;
}
function parseInlineRuns(html, opts = {}) {
  // 入参：li 内部 innerHTML（不含 <li> 外壳）
  // 用 matchAll 替代 stateful exec 循环（更稳健）
  const runs = [];
  const pattern = /<strong[^>]*>([\s\S]*?)<\/strong>|([^<]+)/g;
  for (const m of html.matchAll(pattern)) {
    if (m[1] !== undefined) {
      runs.push(new TextRun({
        text: stripTags(m[1]),
        bold: true,
        color: opts.color || COLOR_DARK,
        size: opts.size || 20,
        font: ZH_FONT,
      }));
    } else if (m[2]) {
      const text = decodeEntities(m[2]);
      if (text) {
        runs.push(new TextRun({
          text,
          color: opts.color || COLOR_DARK,
          size: opts.size || 20,
          font: ZH_FONT,
        }));
      }
    }
  }
  return runs;
}

// ----- HTML 解析 -----
function parseResume(html) {
  let name = '';
  const nm = html.match(/<h1[^>]*class="name"[^>]*>([\s\S]*?)<\/h1>/i);
  if (nm) name = stripTags(nm[1]);

  const contacts = [];
  const cm = html.match(/<div[^>]*class="contact-info"[^>]*>([\s\S]*?)<\/div>/i);
  if (cm) {
    for (const m of cm[1].matchAll(/<span[^>]*class="contact-item"[^>]*>([\s\S]*?)<\/span>/g)) {
      const t = stripTags(m[1]).replace(/\s+/g, ' ').trim();
      if (t) contacts.push(t);
    }
  }

  const sections = [];
  for (const sm of html.matchAll(/<section[^>]*class="section"[^>]*>([\s\S]*?)<\/section>/gi)) {
    const sec = sm[1];
    const tm = sec.match(/<h2[^>]*class="section-title"[^>]*>([\s\S]*?)<\/h2>/i);
    const title = tm ? stripTags(tm[1]).replace(/[\s\u3000]/g, '') : '';

    // 1) 个人简述
    if (sec.includes('summary-text')) {
      const bm = sec.match(/<p[^>]*class="summary-text"[^>]*>([\s\S]*?)<\/p>/i);
      sections.push({ kind: 'summary', title, body: bm ? stripTags(bm[1]) : '' });
      continue;
    }

    // 2) 教育背景
    if (sec.includes('education-item')) {
      const items = [];
      for (const block of extractDivBlocks(sec, 'education-item')) {
        const t = (block.match(/item-title[^>]*>([\s\S]*?)<\/span>/) || [])[1];
        const d = (block.match(/item-date[^>]*>([\s\S]*?)<\/span>/) || [])[1];
        const s = (block.match(/item-subtitle[^>]*>([\s\S]*?)<\/div>/) || [])[1];
        items.push({
          title: t ? stripTags(t) : '',
          date: d ? stripTags(d) : '',
          subtitle: s ? stripTags(s) : '',
        });
      }
      sections.push({ kind: 'education', title, items });
      continue;
    }

    // 3) 工作/项目经历
    if (sec.includes('work-item')) {
      const items = [];
      for (const block of extractDivBlocks(sec, 'work-item')) {
        const t = (block.match(/item-title[^>]*>([\s\S]*?)<\/span>/) || [])[1];
        const s = (block.match(/item-subtitle[^>]*>([\s\S]*?)<\/div>/) || [])[1];
        const d = (block.match(/item-date[^>]*>([\s\S]*?)<\/span>/) || [])[1];
        const descs = [];
        const um = block.match(/<ul[^>]*class="item-desc"[^>]*>([\s\S]*?)<\/ul>/);
        const scope = um ? um[1] : block;
        for (const li of scope.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
          descs.push(li[1].replace(/^<li[^>]*>/i, '').replace(/<\/li>\s*$/i, ''));
        }
        items.push({
          title: t ? stripTags(t) : '',
          subtitle: s ? stripTags(s) : '',
          date: d ? stripTags(d) : '',
          descs,
        });
      }
      sections.push({ kind: 'work', title, items });
      continue;
    }

    // 4) 专业技能
    if (sec.includes('skill-item') || title.includes('专业技能')) {
      const groups = [];
      for (const m of sec.matchAll(/<div[^>]*class="highlight-section"[^>]*>([\s\S]*?)(?=<div[^>]*class="highlight-section"|<\/section>)/g)) {
        const b = m[1];
        const cat = (b.match(/highlight-title[^>]*>([\s\S]*?)<\/div>/) || [])[1];
        const tags = [];
        for (const tg of b.matchAll(/<div[^>]*class="skill-item"[^>]*>([\s\S]*?)<\/div>/g)) {
          const t = stripTags(tg[1]);
          if (t) tags.push(t);
        }
        if (cat || tags.length) groups.push({ category: cat ? stripTags(cat) : '', tags });
      }
      if (!groups.length) {
        const all = [];
        for (const tg of sec.matchAll(/<div[^>]*class="skill-item"[^>]*>([\s\S]*?)<\/div>/g)) {
          const t = stripTags(tg[1]);
          if (t) all.push(t);
        }
        if (all.length) groups.push({ category: '', tags: all });
      }
      sections.push({ kind: 'skill', title, groups });
      continue;
    }

    sections.push({ kind: 'plain', title, text: stripTags(sec).replace(/\s+/g, ' ') });
  }

  return { name, contacts, sections };
}

// ----- 构造段落 -----
function pTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { color: COLOR_RED, space: 1, style: BorderStyle.SINGLE, size: 12 },
    },
    children: [
      new TextRun({
        text: '| ' + text,
        bold: true,
        color: COLOR_DARK,
        size: 28,
        font: ZH_FONT,
      }),
    ],
  });
}

function run(text, opts = {}) {
  return new TextRun({
    text,
    color: opts.color || COLOR_DARK,
    size: opts.size || 21,
    bold: !!opts.bold,
    font: ZH_FONT,
  });
}

function pSectionHeader(leftTitle, rightDate) {
  return new Paragraph({
    spacing: { before: 80, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      run(leftTitle, { bold: true, size: 24, color: COLOR_DARK }),
      new TextRun({ text: '\t', font: ZH_FONT }),
      run(rightDate, { size: 19, color: COLOR_LIGHTGRAY }),
    ],
  });
}

function pSubtitle(text) {
  return new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [run(text, { size: 20, color: COLOR_GRAY })],
  });
}

// 教育背景一行式：学校 [左 bold] + tab + 日期 [最右 浅灰]
// 与工作/项目 pSectionHeader 风格统一：标题在左、日期 tab 推到 TabStopPosition.MAX
function pEducationRow(title, date, subtitle) {
  const children = [
    run(title, { bold: true, size: 22, color: COLOR_DARK }),
    new TextRun({ text: '\t', font: ZH_FONT }),
    run(date || '', { size: 19, color: COLOR_LIGHTGRAY }),
  ];
  const para = new Paragraph({
    spacing: { before: 0, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children,
  });
  // 专业副标题作为第二条独立 paragraph（与 pSubtitle 风格一致）
  return subtitle ? [para, new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [run(subtitle, { size: 20, color: COLOR_GRAY })],
  })] : [para];
}

function pSummary(text) {
  return new Paragraph({
    spacing: { before: 0, after: 120, line: 340 },
    alignment: AlignmentType.JUSTIFIED,
    children: [run(text, { size: 21, color: COLOR_DARK })],
  });
}

function pBullet(htmlFragment) {
  return new Paragraph({
    spacing: { before: 0, after: 60, line: 320 },
    indent: { left: 360, hanging: 200 },
    children: [
      new TextRun({ text: '· ', color: COLOR_RED, bold: true, size: 21, font: ZH_FONT }),
      ...parseInlineRuns(htmlFragment, { color: COLOR_DARK, size: 20 }),
    ],
  });
}

function pSkillGroup(category, tags) {
  const children = [];
  if (category) {
    children.push(run(category + '  ', { bold: true, size: 22, color: COLOR_RED }));
  }
  for (let i = 0; i < tags.length; i++) {
    children.push(run(tags[i] + (i < tags.length - 1 ? '   ' : ''), { size: 20, color: COLOR_DARK }));
  }
  return new Paragraph({
    spacing: { before: 40, after: 60, line: 320 },
    shading: { fill: COLOR_HIGHLIGHT_BG, type: ShadingType.CLEAR },
    border: {
      left: { color: COLOR_RED, space: 4, style: BorderStyle.SINGLE, size: 18 },
    },
    children,
  });
}

function pSpacer() {
  return new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun('')] });
}

// ----- 构造文档 -----
function build(data) {
  const docHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        shading: { fill: COLOR_DARK, type: ShadingType.CLEAR, color: 'auto' },
        border: {
          bottom: { color: COLOR_RED, space: 4, style: BorderStyle.SINGLE, size: 18 },
        },
        children: [
          new TextRun({ text: ' ', color: COLOR_WHITE, size: 20, font: ZH_FONT }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({
            text: data.name,
            bold: true,
            color: COLOR_WHITE,
            size: 56,
            font: ZH_FONT,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: '信息安全工程师 · 简历',
            color: COLOR_LIGHTGRAY,
            size: 22,
            font: ZH_FONT,
          }),
        ],
      }),
    ].concat(data.contacts.length ? [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: data.contacts.map((c, i) => new TextRun({
          text: c + (i < data.contacts.length - 1 ? '     ' : ''),
          color: 'CCCCCC',
          size: 20,
          font: ZH_FONT,
        })),
      }),
    ] : []),
  });

  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: '期待与贵司共同推动安全合规体系建设',
            color: '999999',
            size: 18,
            italics: true,
            font: ZH_FONT,
          }),
        ],
      }),
    ],
  });

  const children = [];
  for (const sec of data.sections) {
    children.push(pTitle(sec.title));
    if (sec.kind === 'summary') {
      children.push(pSummary(sec.body));
    } else if (sec.kind === 'education') {
      for (const it of sec.items) {
        children.push(...pEducationRow(it.title, it.date, it.subtitle));
      }
    } else if (sec.kind === 'work') {
      for (const it of sec.items) {
        children.push(pSectionHeader(it.title, it.date || ''));
        if (it.subtitle) children.push(pSubtitle(it.subtitle));
        for (const d of it.descs) children.push(pBullet(d));
      }
    } else if (sec.kind === 'skill') {
      for (const g of sec.groups) children.push(pSkillGroup(g.category, g.tags));
    } else if (sec.kind === 'plain') {
      children.push(new Paragraph({ children: [run(sec.text)] }));
    }
    children.push(pSpacer());
  }

  return new Document({
    creator: data.name,
    title: `${data.name} - 简历`,
    description: '信息安全工程师简历',
    styles: {
      default: {
        document: { run: { font: ZH_FONT, size: 21 } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1700, right: 1100, bottom: 1100, left: 1100 },
        },
      },
      headers: { default: docHeader },
      footers: { default: docFooter },
      children,
    }],
  });
}

// ----- Main -----
async function main() {
  const inputHtml = process.argv[2] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-11.html';
  const outputDocx = process.argv[3] || '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-14.docx';
  const html = fs.readFileSync(inputHtml, 'utf8');
  const data = parseResume(html);
  console.log(`提取: ${data.name} | 联系: ${data.contacts.length} | sections: ${data.sections.length}`);
  for (const s of data.sections) console.log(`  - ${s.title} (${s.kind})`);

  const doc = build(data);
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocx, buf);
  const stat = fs.statSync(outputDocx);
  console.log(`DOCX 已生成: ${outputDocx} (${(stat.size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
