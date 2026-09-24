#!/usr/bin/env python3
"""HTML 简历 → PDF（reportlab + CID 中文字体）
忠实还原 HTML 设计：深色 header、红色装饰条、红色 section 标题等。
"""
import re
import sys
import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import mm

ZH_FONT = 'STSong-Light'
pdfmetrics.registerFont(UnicodeCIDFont(ZH_FONT))

COLOR_RED = HexColor('#e31837')
COLOR_DARK = HexColor('#1a1a1a')
COLOR_DARK2 = HexColor('#2d2d2d')
COLOR_GRAY = HexColor('#666666')
COLOR_LIGHTGRAY = HexColor('#999999')
COLOR_WHITE = HexColor('#ffffff')
COLOR_HIGHLIGHT_BG = HexColor('#fafafa')


def strip_tags(s):
    s = re.sub(r'<[^>]+>', '', s)
    return (s.replace('&nbsp;', ' ').replace('&amp;', '&')
            .replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
            .replace('&#39;', "'"))


def parse_resume(html):
    """结构化解析简历 HTML"""
    # 姓名
    name = ''
    m = re.search(r'<h1[^>]*class="name"[^>]*>(.*?)</h1>', html, re.S | re.I)
    if m:
        name = strip_tags(m.group(1)).strip()

    # 联系信息（在 contact-info 容器里，contact-item 是 <span>）
    contacts = []
    cm = re.search(r'<div[^>]*class="contact-info"[^>]*>([\s\S]*?)</div>', html, re.I)
    if cm:
        for span in re.finditer(r'<span[^>]*class="contact-item"[^>]*>(.*?)</span>', cm.group(1), re.S):
            text = strip_tags(span.group(1)).strip()
            text = re.sub(r'\s+', ' ', text)
            if text: contacts.append(text)

    sections = []
    for sec_m in re.finditer(r'<section[^>]*class="section"[^>]*>([\s\S]*?)</section>', html, re.I):
        sec = sec_m.group(1)
        title_m = re.search(r'<h2[^>]*class="section-title"[^>]*>(.*?)</h2>', sec, re.I)
        title = strip_tags(title_m.group(1)).replace(' ', '').replace('\u3000', '').strip() if title_m else ''

        # 1) 个人简述
        if 'summary-text' in sec:
            body = re.search(r'<p[^>]*class="summary-text"[^>]*>([\s\S]*?)</p>', sec, re.I)
            text = strip_tags(body.group(1)).strip() if body else ''
            sections.append({'kind': 'summary', 'title': title, 'body': text})
            continue

        # 2) 教育背景（结构同 work-item：item-title / item-date / item-subtitle）
        if 'education-item' in sec:
            items = []
            # 用起始位置切分，避免 finditer + lookahead 的边界 bug
            starts = [m.start() for m in re.finditer(r'<div[^>]*class="education-item"[^>]*>', sec)]
            for k, a in enumerate(starts):
                b = starts[k+1] if k+1 < len(starts) else sec.find('</section>', a)
                if b < 0: b = len(sec)
                item_html = sec[a:b]
                item_title = ''
                tm = re.search(r'item-title[^>]*>(.*?)</span>', item_html, re.S)
                if tm: item_title = strip_tags(tm.group(1)).strip()
                item_date = ''
                dm = re.search(r'item-date[^>]*>(.*?)</span>', item_html, re.S)
                if dm: item_date = strip_tags(dm.group(1)).strip()
                item_subtitle = ''
                sm = re.search(r'item-subtitle[^>]*>(.*?)</div>', item_html, re.S)
                if sm: item_subtitle = strip_tags(sm.group(1)).strip()
                items.append({'title': item_title, 'date': item_date, 'subtitle': item_subtitle, 'desc': []})
            sections.append({'kind': 'education', 'title': title, 'items': items})
            continue

        # 3) 工作经历 / 核心项目经历（都是 work-item）
        if 'work-item' in sec:
            items = []
            section_title = title
            # 按起始位置切分（避免 finditer + lookahead 边界 bug）
            starts = [m.start() for m in re.finditer(r'<div[^>]*class="work-item"[^>]*>', sec)]
            for k, a in enumerate(starts):
                b = starts[k+1] if k+1 < len(starts) else sec.find('</section>', a)
                if b < 0: b = len(sec)
                item_html = sec[a:b]
                item_title = ''
                tm = re.search(r'item-title[^>]*>(.*?)</span>', item_html, re.S)
                if tm: item_title = strip_tags(tm.group(1)).strip()
                subtitle = ''
                sm = re.search(r'item-subtitle[^>]*>(.*?)</div>', item_html, re.S)
                if sm: subtitle = strip_tags(sm.group(1)).strip()
                date = ''
                dm = re.search(r'item-date[^>]*>(.*?)</span>', item_html, re.S)
                if dm: date = strip_tags(dm.group(1)).strip()
                descs = []
                # 优先 item-desc 容器
                um = re.search(r'<ul[^>]*class="item-desc"[^>]*>([\s\S]*?)</ul>', item_html, re.S)
                if um:
                    for li in re.finditer(r'<li[^>]*>([\s\S]*?)</li>', um.group(1), re.S):
                        descs.append(strip_tags(li.group(1)).strip())
                else:
                    for li in re.finditer(r'<li[^>]*>([\s\S]*?)</li>', item_html, re.S):
                        descs.append(strip_tags(li.group(1)).strip())
                items.append({'title': item_title, 'subtitle': subtitle, 'date': date, 'desc': descs})
            sections.append({'kind': 'work', 'title': section_title, 'items': items})
            continue

        # 4) 专业技能（highlight-section + skill-item）
        if 'skill-item' in sec or '专业技能' in title:
            skills = []
            # 按 highlight-section 分组（每个组有 highlight-title）
            for hm in re.finditer(r'<div[^>]*class="highlight-section"[^>]*>([\s\S]*?)(?=<div class="highlight-section"|</section>)', sec, re.S):
                block = hm.group(1)
                cat_m = re.search(r'highlight-title[^>]*>(.*?)</div>', block, re.S)
                cat_name = strip_tags(cat_m.group(1)).strip() if cat_m else ''
                tags = []
                for tag in re.findall(r'<div[^>]*class="skill-item"[^>]*>([\s\S]*?)</div>', block, re.S):
                    text = strip_tags(tag).strip()
                    if text: tags.append(text)
                if cat_name or tags:
                    skills.append({'category': cat_name, 'tags': tags})
            if not skills:
                # 退路：扁平提取
                for tag in re.findall(r'<div[^>]*class="skill-item"[^>]*>([\s\S]*?)</div>', sec, re.S):
                    text = strip_tags(tag).strip()
                    if text: skills.append({'category': '', 'tags': [text]})
            sections.append({'kind': 'skill', 'title': title, 'groups': skills})
            continue

        # 默认
        text = strip_tags(sec)
        text = re.sub(r'\s+', ' ', text).strip()
        sections.append({'kind': 'plain', 'title': title, 'text': text})

    return {'name': name, 'contacts': contacts, 'sections': sections}


class ResumePDF:
    def __init__(self, output_pdf):
        self.c = canvas.Canvas(output_pdf, pagesize=A4)
        self.page_w, self.page_h = A4
        self.margin_x = 18 * mm
        self.y = self.page_h - 18 * mm
        self.cw = self.page_w - 2 * self.margin_x
        self.line_h_normal = 5.2 * mm
        self.line_h_large = 6 * mm

    def new_page(self):
        self.c.showPage()
        self.y = self.page_h - 18 * mm
        self.c.setFont(ZH_FONT, 10)

    def ensure(self, h):
        if self.y - h < 18 * mm:
            self.new_page()

    def wrap_text(self, text, font_size, max_width):
        self.c.setFont(ZH_FONT, font_size)
        lines = []
        current = ''
        for ch in text:
            test = current + ch
            if self.c.stringWidth(test, ZH_FONT, font_size) > max_width:
                if current: lines.append(current)
                current = ch
            else:
                current = test
        if current: lines.append(current)
        return lines

    def draw_dark_header(self, name, contacts):
        header_h = 42 * mm
        # 深色渐变（两层矩形近似）
        self.c.setFillColor(COLOR_DARK)
        self.c.rect(0, self.page_h - header_h, self.page_w, header_h, fill=1, stroke=0)
        self.c.setFillColor(Color(0.18, 0.18, 0.18))
        self.c.rect(0, self.page_h - header_h, self.page_w, header_h * 0.5, fill=1, stroke=0)

        # 姓名（白色大字）
        name_y = self.page_h - 20 * mm
        self.c.setFillColor(COLOR_WHITE)
        self.c.setFont(ZH_FONT, 28)
        self.c.drawString(self.margin_x, name_y, name)

        # 副标题（如有）
        sub = '信息安全工程师 · 简历'
        self.c.setFillColor(HexColor('#999999'))
        self.c.setFont(ZH_FONT, 11)
        self.c.drawString(self.margin_x, name_y - 7 * mm, sub)

        # 联系信息
        if contacts:
            contact_y = self.page_h - 36 * mm
            self.c.setFillColor(HexColor('#cccccc'))
            self.c.setFont(ZH_FONT, 10)
            x = self.margin_x
            max_x = self.page_w - self.margin_x
            for ct in contacts:
                w = self.c.stringWidth(ct, ZH_FONT, 10)
                if x + w > max_x:
                    contact_y -= 5 * mm
                    x = self.margin_x
                self.c.drawString(x, contact_y, ct)
                x += w + 8 * mm

        # 红色装饰条
        bar_y = self.page_h - header_h
        self.c.setFillColor(COLOR_RED)
        self.c.rect(0, bar_y, self.page_w, 1.5 * mm, fill=1, stroke=0)

        self.y = bar_y - 10 * mm

    def draw_section_title(self, title):
        self.ensure(15 * mm)
        title_h = 8 * mm
        # 左侧红色竖条
        self.c.setFillColor(COLOR_RED)
        self.c.rect(self.margin_x, self.y - title_h * 0.2, 1.2 * mm, title_h * 0.8, fill=1, stroke=0)
        # 标题
        self.c.setFillColor(COLOR_DARK)
        self.c.setFont(ZH_FONT, 14)
        self.c.drawString(self.margin_x + 4 * mm, self.y - 1 * mm, title)
        # 红色下划线
        line_y = self.y - title_h + 0.5 * mm
        self.c.setStrokeColor(COLOR_RED)
        self.c.setLineWidth(0.8)
        self.c.line(self.margin_x, line_y, self.page_w - self.margin_x, line_y)
        self.y -= title_h + 4 * mm

    def draw_paragraph(self, text, font_size=10.5, indent_mm=0, color=COLOR_DARK):
        x = self.margin_x + indent_mm
        for line in self.wrap_text(text, font_size, self.cw - indent_mm):
            self.ensure(self.line_h_normal)
            self.c.setFillColor(color)
            self.c.setFont(ZH_FONT, font_size)
            self.c.drawString(x, self.y, line)
            self.y -= self.line_h_normal
        self.y -= 2 * mm

    def draw_summary(self, text):
        self.draw_paragraph(text, 10.5, color=COLOR_DARK)

    def draw_education_items(self, items):
        for it in items:
            self.ensure(16 * mm)
            # 学校名（深色加粗 12pt）+ 日期（右对齐灰色）
            self.c.setFillColor(COLOR_DARK)
            self.c.setFont(ZH_FONT, 12)
            self.c.drawString(self.margin_x, self.y, it['title'])
            if it.get('date'):
                self.c.setFillColor(COLOR_LIGHTGRAY)
                self.c.setFont(ZH_FONT, 9.5)
                dw = self.c.stringWidth(it['date'], ZH_FONT, 9.5)
                self.c.drawString(self.page_w - self.margin_x - dw, self.y + 1.5 * mm, it['date'])
            self.y -= 5.5 * mm
            # 专业（灰色副标题）
            if it.get('subtitle'):
                self.c.setFillColor(COLOR_GRAY)
                self.c.setFont(ZH_FONT, 10)
                self.c.drawString(self.margin_x, self.y, it['subtitle'])
                self.y -= 5 * mm
            self.y -= 1 * mm  # 卡片间隔

    def draw_work_items(self, items):
        for it in items:
            # 公司/项目名 + 日期（右对齐）
            self.ensure(20 * mm)
            head = it['title']
            self.c.setFillColor(COLOR_DARK)
            self.c.setFont(ZH_FONT, 12)
            self.c.drawString(self.margin_x, self.y, head)
            # 日期（灰色，右对齐）
            if it.get('date'):
                self.c.setFillColor(COLOR_LIGHTGRAY)
                self.c.setFont(ZH_FONT, 9.5)
                dw = self.c.stringWidth(it['date'], ZH_FONT, 9.5)
                self.c.drawString(self.page_w - self.margin_x - dw, self.y + 1.5 * mm, it['date'])
            self.y -= 5.5 * mm
            # 副标题（灰色）
            if it.get('subtitle'):
                self.c.setFillColor(COLOR_GRAY)
                self.c.setFont(ZH_FONT, 10)
                self.c.drawString(self.margin_x, self.y, it['subtitle'])
                self.y -= 5 * mm
            # 描述列表
            for d in it['desc']:
                bullet = '· ' + d
                for line in self.wrap_text(bullet, 10, self.cw - 3 * mm):
                    self.ensure(5.5 * mm)
                    self.c.setFillColor(COLOR_DARK)
                    self.c.setFont(ZH_FONT, 10)
                    self.c.drawString(self.margin_x + 3 * mm, self.y, line)
                    self.y -= 5.2 * mm
            self.y -= 3 * mm

    def draw_skill_groups(self, groups):
        for g in groups:
            self.ensure(20 * mm)
            # 类别名（黑色加粗）
            if g.get('category'):
                self.c.setFillColor(COLOR_RED)
                self.c.setFont(ZH_FONT, 11)
                self.c.drawString(self.margin_x, self.y, g['category'])
                cat_w = self.c.stringWidth(g['category'], ZH_FONT, 11)
                # 技能标签
                tags_text = '  '.join(g['tags'])
                self.c.setFillColor(COLOR_DARK)
                self.c.setFont(ZH_FONT, 10)
                # 如果一行放不下则换行
                available = self.cw - cat_w - 3 * mm
                words = g['tags']
                line_tags = []
                x_offset = cat_w + 3 * mm
                first_line = True
                for tag in words:
                    tw = self.c.stringWidth(tag, ZH_FONT, 10)
                    if x_offset + tw > self.page_w - self.margin_x:
                        # 输出当前行
                        self.y -= 5 * mm
                        self.ensure(5.5 * mm)
                        x_offset = self.margin_x
                    self.c.drawString(self.margin_x + x_offset, self.y, tag)
                    x_offset += tw + 6  # 间距
                self.y -= 6 * mm
            elif g.get('tags'):
                self.c.setFillColor(COLOR_DARK)
                self.c.setFont(ZH_FONT, 10)
                self.c.drawString(self.margin_x, self.y, '  '.join(g['tags']))
                self.y -= 5.5 * mm
        self.y -= 2 * mm

    def save(self):
        self.c.save()


def draw_resume(input_html, output_pdf):
    with open(input_html, 'r', encoding='utf-8') as f:
        html = f.read()
    data = parse_resume(html)
    print(f'提取: {data["name"]} | 联系: {len(data["contacts"])} | sections: {len(data["sections"])}')
    for s in data['sections']:
        print(f'  - {s["title"]} ({s["kind"]})')

    pdf = ResumePDF(output_pdf)
    pdf.draw_dark_header(data['name'], data['contacts'])

    for sec in data['sections']:
        pdf.draw_section_title(sec['title'])
        kind = sec['kind']
        if kind == 'summary':
            pdf.draw_summary(sec['body'])
        elif kind == 'education':
            pdf.draw_education_items(sec['items'])
        elif kind == 'work':
            pdf.draw_work_items(sec['items'])
        elif kind == 'skill':
            pdf.draw_skill_groups(sec['groups'])
        elif kind == 'plain':
            pdf.draw_paragraph(sec['text'])

    pdf.save()
    size = os.path.getsize(output_pdf)
    print(f'PDF 已生成: {output_pdf} ({size/1024:.1f} KB)')


if __name__ == '__main__':
    input_html = sys.argv[1] if len(sys.argv) > 1 else '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-11.html'
    output_pdf = sys.argv[2] if len(sys.argv) > 2 else '/home/agent/.claude/workspace/project/uploads/简历_姜植藂_2026-07-14.pdf'
    draw_resume(input_html, output_pdf)
