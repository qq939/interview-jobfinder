# 面试 Jobfinder（面试题直通车）

> 一站式字节跳动面试题聚合页 + AI 助手对话面板

[![Node.js](https://img.shields.io/badge/Node.js-v20.20.2-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Port](https://img.shields.io/badge/Port-8082-blue)](http://localhost:8082)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 项目简介

**面试 Jobfinder** 是一个面向求职者的面试准备 Web 应用，主页是「字节跳动 · 面试题直通车」（按岗位 / 技能分类的卡片式面试题库），同时内置一个可与本地 Claude CLI 对话的 AI 助手面板。

## 功能特性

### 主页 15 个 Tab

| 分类 | Tab |
|------|-----|
| 岗位（5） | 后端、客户端、前端、算法岗、测试岗 |
| 安全技能（4） | 合规认证、零信任安全、云安全、身份权限 |
| 数据库（2） | SQL、Supabase |
| 语言（2） | JavaScript、TypeScript |
| 工控（1） | Modbus TCP |
| AI 助手（1） | Claude 对话面板 + tmpfile 侧边栏 |

### AI 助手对话
- 一问一答式聊天
- SSE 流式响应
- 支持文件上传（PDF / DOC / DOCX / TXT / 图片）
- 图文问答模式（自动 `CLAUDE_IMG=1` + `tmp.png` 引用）
- 对话持久化（`uploads/dialogs/`）
- 历史对话默认显示最近 5 轮
- tmpfile 侧边栏实时显示 prompt 上下文
- **右侧预览列「从顶至底」**：AI 助手 Tab 下 `#tmpfile-sidebar` 用 `position:fixed`（`top/bottom: 2rem`）钉在视口右侧，从页面顶部贯通到底部，PDF / DOCX 预览 iframe 随之占满整列；左侧为标题 + Tabs + 对话框（`#chat-area` 撑到底部）。切 Tab 时 `syncAiTabHeight()` 增删 `body.ai-active`（右侧让出 368px 并重算高度），`resize` / `load` 自动重算；其它 Tab 不受影响
- 布局截图见 `docs/screenshots/`

### 辅助能力
- 简历改写与 OBS 上传（`obs.dimond.top`，HTTP PUT 根路径）

### 文件预览（tmpfile 侧边栏）
文件列表点击后，后端 `/api/uploads/file/<name>` 按扩展名返回不同结构，前端统一渲染：

| 类型 | 后端响应 | 前端展示 |
|------|---------|---------|
| `.pdf` | `type:"embed"` + base64 | iframe 内嵌 `data:application/pdf` |
| `.docx` | `type:"docx-html"` + 转换后的 HTML（mammoth） | iframe `srcdoc` 渲染，保留表格/列表/内联图片 |
| `.txt` | `content` 字段（utf8 文本） | `<pre>` 纯文本 |
| `.doc` 等其他二进制 | `type:"binary"` | `[二进制文件]` 提示 |

后端 DOCX 预览使用 [mammoth](https://github.com/mwilliamson/mammoth.js) 将 DOCX 转换为标准 HTML（中文、表格、列表、内联图片均保留），前端通过 iframe `srcdoc` 渲染，不引入额外前端依赖。

### 一键上传到 OBS
预览区域右上角有 **「↑ 上传到 OBS」** 按钮，点击后调用 `POST /api/uploads/upload-to-obs`，服务端读取 `uploads/` 下的本地文件 → PUT 到 `http://obs.dimond.top/<encoded filename>`。上传成功后在按钮旁显示 OBS URL（含「打开」链接）。

- 仅支持根路径（OBS endpoint 不支持子目录，文件名已 `encodeURIComponent`）
- 保留中文字符（uploads/ 里的文件可能是外部直接拷贝，未走 ASCII 化）
- 10MB 以下文件；PDF / DOCX / DOC / TXT / 图片均支持

## 技术栈

- **Node.js** v20.20.2 + 原生 HTTP 服务器
- **Claude AI CLI** 集成（`--continue` 保持上下文连贯，`--dangerously-skip-permissions` 跳过确认）
- **SSE** (Server-Sent Events) 流式响应
- **Playwright** 端到端测试
- **mammoth** DOCX → HTML（文件预览）
- **reportlab** + CID 字体（PDF 转换辅助）

## 项目结构

```
project/
├── server.js                # 主服务器（端口 8082）
├── page.html                # 主页（15 个 Tab）
├── package.json             # 依赖
├── gen.js                   # HTML 生成脚本
├── run_claude.js            # Claude CLI 调用封装
├── start.sh                 # 容器 CMD 入口
├── user_start.sh            # 容器自动启动脚本
├── node_modules/            # 依赖
├── uploads/                 # 用户上传 + 对话持久化 + tmpfile
├── logs/                    # 启动 / 运行 / Claude TUI 日志
├── e2e_*.js / e2e-*.js      # 端到端测试脚本
├── test-*.js / test_*.py    # 其他测试
├── tests/                   # 测试用例
├── html_to_pdf_reportlab.py # PDF 转换辅助
├── boss_job_scraper.py      # BOSS 直聘岗位挖掘
├── AGENTS.md / IDENTITY.md / SOUL.md / TOOLS.md / USER.md
├── systemreadme.md          # 容器内规范
└── SKILL.md                 # AI 助手 system prompt
```

## 快速开始

### 启动服务

```bash
# 方式一：容器自动启动入口（推荐）
bash ./user_start.sh

# 方式二：直接启动
node server.js

# 方式三：指定端口
PORT=8082 node server.js
```

启动后访问 http://localhost:8082

### 健康检查

```bash
curl http://localhost:8082/health
# → 200 OK
```

### 安装依赖

```bash
npm install
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 主页 |
| `GET` | `/health` | 健康检查 |
| `POST` | `/api/claude` | Claude SSE 流式对话（主要接口） |
| `POST` | `/upload` | 文件上传 |
| `GET` | `/api/session/:id` | 恢复会话 |
| `GET` | `/api/dialogs` | 对话历史列表（最近 5 轮） |
| `GET` | `/api/dialogs/:id` | 指定对话详情 |
| `GET` | `/ask/claude?q=...` | Claude Ask（智能 base64 / URL-encode 识别） |
| `POST` | `/api/dialogs/:id/append-generated` | 登记 Claude 产出文件 |
| `POST` | `/api/uploads/upload-to-obs` | 把 `uploads/` 下的文件上传到 `obs.dimond.top`（表单字段 `fileName`） |

详细规范参见 `systemreadme.md`。

## nginx 反代配置示例

```nginx
location /jobfinder {
    proxy_pass http://localhost:8082;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    proxy_buffering off;
    chunked_transfer_encoding on;
}
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务器端口 | `8082` |
| `ANTHROPIC_DISABLE_PREFLIGHT` | 禁用 Claude 预检 | `1` |
| `JOBFINDER_DATA_DIR` | 数据根目录 | 项目根目录 |

## 开发

### 测试

```bash
# 端到端测试
node e2e_*.js

# Playwright
npx playwright test
```

### 日志

- 启动日志：`logs/start.log`
- 运行日志：`logs/server_<timestamp>.log`
- Claude TUI 会话日志：`logs/agent_tui.log`

## 用户基本信息

- **姓名**：姜植藂
- **电话**：17600192516
- **邮箱**：jiangzhicong2516@163.com
- **所在地**：北京通州区景盛北一街甲 12 号
- **学历**：中国政法大学硕士 + 中国地质大学本科（211 双背景）
- **技能**：Python / Java / Go / SQL + Service Mesh（Istio / Linkerd / SPIFFE / mTLS）+ 零信任（PKI / FIDO2）
- **英语流利**

## 联系方式

如有问题请提交 [Issue](https://github.com/qq939/interview-jobfinder/issues)。