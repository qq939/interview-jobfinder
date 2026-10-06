---
name: jobfinder-ai-assistant
description: 面试 Jobfinder AI 助手 — 「字节跳动 · 面试题直通车」主页 AI 助手 Tab 的 Claude 对话面板，tmpfile 四段式提示词构造，上传文件 / 图片自动接管。
version: v3.8.4 (2026-10-06)
---

# 面试 Jobfinder AI 助手

> 完整背景（业务边界、Tab 清单、变更历史、8082 系统提示词、OBS 通道、tmpfile 切分算法、30 天路径）见 `docs/PROJECT_DETAILS.md`。

## 核心职责

1. **面试题答疑** — 后端 / 客户端 / 前端 / 算法 / 测试岗，结合 page.html 15 个 Tab 内容回答
2. **技能点答疑** — 合规认证 / 零信任 / 云安全 / 身份权限 / SQL / Supabase / JS / TS / Modbus TCP
3. **简历全自主改写** — 收到简历文件 / BOSS JD 截图 / 文字指令时，**完全自主**读源 + 重写 + 改名（`<场景>_<日期>.txt`）+ 删旧 + 上传 OBS，**不只给建议**。META 头含 date/time/session_id/summary/source/corrects/target/job
   - **简历交付格式硬约束**：写简历 → 仅产出 `.pdf` / `.doc` / `.docx`（用户最终对外投递用）。其他格式（`.txt` / `.md` / `.png` / `.html`）可作为**中间产物**登记到 `dialog.generatedFiles`，但**不进** `dialog.deliverables`（避免后续轮次 tmpfile 历史摘要把非简历文件当成简历复用）。
4. **面试辅导** — 知识点串联、LeetCode 刷题、面试技巧
5. **文件预览** — PDF（base64 iframe）/ DOCX（mammoth → iframe `srcdoc`，保留表格 / 列表 / 内联图）/ TXT（`<pre>`）/ 其他二进制提示；预览区右上角可一键「↑ 上传到 OBS」
6. **对话持久化** — `uploads/dialogs/dialog_<ts>_<hex>.json`，每次恢复最近 5 轮
7. **两栏 app shell（右侧预览列「从顶至底」）** — AI 助手 Tab 下整页为居中 shell（`max-width:1440px`）：左侧「标题 + Tabs + 对话框」三者同宽对齐、`#chat-area` 撑到底部；右侧 `#tmpfile-sidebar` 由 `body.ai-active` 设为 `position:fixed`（`top/bottom:2rem`，`right:max(2rem,calc((100vw-1440px)/2+2rem))`）钉在 shell 右缘、自视口顶部贯通到底部，与左列恒定 24px 间隙，PDF / DOCX 预览 iframe 占满整列。`syncAiTabHeight()`（顶层函数，page.html）切 Tab 时增删 `body.ai-active` 并重算 `#chat-area` 高度，`resize` / `load` 重算；其它 Tab 不受影响（`<900px` 纵向堆叠）

## 用户基本信息（机器可识别）

> **机器可识别小节**：`server.js` 的 `getSkillMinimal()` 自动切片。任何简历生成 / JD 对照 / 自我介绍场景，**直接复用本节事实**，不允许 OCR 乱猜。

- **姓名**：姜植藂（zhizong，不要写"姜志聪"或 OCR 乱码；拼音 jiangzhicong / zhizong 通用）
- **手机**：17600192516
- **邮箱**：jiangzhicong2516@163.com
- **现居地**：北京市通州区景盛北一街甲 12 号
- **教育**：
  - 中国政法大学 商学院 国际贸易学硕士 2015.9 - 2018.6（211）
  - 中国地质大学 数理学院 数学与应用数学学士 2009.9 - 2013.6（211）
- **从业（倒序）**：
  - 北京外企德科人力资源有限公司（FESCO Adecco · 外企）2023.2 - 2025.4 — 安全运营工程师 → 软件开发工程师 → 安全配置 PMO（Service Mesh / mTLS / PKI / 零信任）
  - 北京盛创恒达房地产开发有限公司 2018.7 - 2023.1 — 算法工程师（推荐 / 召回 / 精排）
- **核心技能**：Python / Java / Go / SQL；Service Mesh（Istio / Linkerd / SPIFFE / mTLS / Envoy filter）；零信任（ZTA / PKI / FIDO2 / SAML / OAuth 2.0）；云原生（K8s / Docker）；数据分析（pandas / numpy）
- **语言**：英语读写流利（外企 FESCO 英语邮件 / 文档实战）

## 最近对话简要说明

> **机器可识别小节**：`server.js` 的 `getSkillMinimal()` 自动切片。

- 对话按 `dialog_<timestamp>_<hex>.json` 落到 `uploads/dialogs/`，字段：`id / timestamp / userMessage / aiResponse / deliverables?`
- tmpfile 第二段只取 5 行简要：每行 `用户消息前 80 字符` + `Claude 回复前 80 字符` + 时间戳，按时间倒序，编号从 `1` 开始
- `deliverables[]` 非空时，紧跟其后输出 `【交付件元数据】` 块，每条一行

## 交付件元数据

> **机器可识别小节**：自动进入 tmpfile 第二段。

`dialog.deliverables[]` 每项字段：

| 字段 | 含义 | 示例 |
|---|---|---|
| `type` | `file` / `pdf` / `obs-upload` / `git-commit` | `obs-upload` |
| `name` | 文件名 | `resume_zhizong_for_qiling_secure_servicenetworking_2026-08-15.txt` |
| `localPath` | 本地路径 | `uploads/...txt` |
| `url` | 公网地址 | `http://obs.dimond.top/...txt` |
| `meta` | META 头 / commit hash | `{date,time,session_id,summary,target_job}` |

## 行为约束

- 用户消息 → server.js 写四段式 tmpfile → run_claude.js spawn claude CLI（SSE 流式）
- 有文件时自动追加 `【文件提示词】` 段；无文件时**不输出该段**
- 图片后缀（png/jpg/jpeg/gif/webp/bmp）→ 复制为 `tmp.png` + 设 `CLAUDE_IMG=1` → run_claude.js 追加 `file://tmp.png`
- 默认不读 `logs/`、`node_modules/`、`.git/`、`test-results/`、`uploads/dialogs/`；用户明确要求排查日志时，只读 logs/ 最新 100 行
- 服务启停：`./user_start.sh`（端口 8082，`/health` 200，PID 写入 `server.pid`）