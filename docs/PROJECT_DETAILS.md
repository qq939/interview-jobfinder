# 项目细节文档（SKILL.md 引用入口）

> SKILL.md 只保留核心三节（核心职责 / 最近对话简要说明 / 交付件元数据），其余内容搬迁到本文件。
> 本文件由 SKILL.md 引用，作为人类可读背景，按需查阅。

## 1. 业务定位

本项目是 **面试 Jobfinder（面试题直通车）**，不是「AI 找工作教练 / 简历管理员」。主页是 **15 个 Tab** 的字节跳动面试题聚合页：

- **岗位 5**：后端 / 客户端 / 前端 / 算法岗 / 测试岗
- **安全技能 4**：合规认证 / 零信任安全 / 云安全 / 身份权限（共 46 张带官方标准/文档链接卡）
- **数据库 2**：SQL / Supabase
- **语言 2**：JavaScript / TypeScript（各 16 张卡，链接 MDN / typescriptlang.org）
- **工控 1**：Modbus TCP（30 天每日学习路径 + 技能点 + 面试题）
- **AI 助手 1**：Claude 对话面板 + tmpfile 侧边栏

本文件描述的是 **AI 助手 Tab** 的对话行为 — 用户在主页点击「AI 助手」Tab 时，本 AI 通过 `/api/claude` (SSE) 与 Claude CLI 通讯，回复用户关于面试题 / 简历 / 上传文件的问题。

## 2. 业务边界

| 项 | 是不是核心 | 说明 |
|---|---|---|
| 「字节跳动 · 面试题直通车」主页 15 个 Tab 静态内容 | ✅ 是 | 项目真正核心，由 `page.html` 渲染（~114 KB） |
| AI 助手 Tab 的 Claude 对话能力 | ✅ 是 | 通过 `/api/claude` SSE 调用 Claude CLI |
| tmpfile 机制（uploads/tmpfile.txt） | ✅ 是 | AI 助手 Tab 上下文构造 |
| 对话持久化（uploads/dialogs/） | ✅ 是 | 历史 5 轮 |
| 8082 `/ask/claude` 端点 | ✅ 是 | 按 `systemreadme.md` 核心二，给容器外的其他服务（如 Tools Hub）一个简单的 GET/POST 问 Claude 接口 |
| HTML 简历 → PDF 转换 | ❌ 辅助 | 用户偶尔要求时才触发（`html_to_pdf_reportlab.py`） |
| OBS 文件上传 | ❌ 辅助 | PDF / 文件生成的输出通道（http://obs.dimond.top） |

## 3. 最近对话 schema

### 文件命名

`uploads/dialogs/dialog_<timestamp_ms>_<hex>.json`

### JSON 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | `<timestamp>_<hex>` |
| `timestamp` | number | ms 时间戳 |
| `userMessage` | string | 用户原文（不再加"用户已上传..."前缀，由 `generateTmpFileContent` 接管） |
| `aiResponse` | string | Claude 回复全文 |
| `fileName` | string? | 用户上传文件名（无文件时为 null） |
| `deliverables` | array? | 交付件元数据（见 SKILL.md "交付件元数据"） |

## 4. tmpfile 四段式结构

```
【用户问题】           ← 第 1 段：用户原文（无任何前缀）
<userMessage>
---
【最近对话简要说明】   ← 第 2 段：5 行简要 + 交付件元数据
...
## 核心职责            ← 第 3 段：SKILL.md 切片（核心职责 / 最近对话简要说明 / 交付件元数据）
## 最近对话简要说明
## 交付件元数据
---
【文件提示词】         ← 第 4 段：仅当 fileName 存在时才有
我已经把文件上传至 uploads 文件夹...
---
【用户问题】           ← 第 5 段：用户原文重复（让 Claude 最后看到）
<userMessage>
```

体积实测（旧 → 新）：
- 旧：62,733 B
- 新（无文件）：1,843 B
- 新（有文件）：3,191 B
- 缩减 ~97%

## 5. 变更历史

- **v3.2 (2026-07-16)**：业务归位 — 之前 v3.1 错把项目整体写成「AI 找工作教练 & 简历管理员」，回归到正确的业务边界。
- **v3.3 (2026-07-17)**：服务再次自启（PID 56，端口 8082 OPEN）；同步 `systemreadme.md` 14.3 响应格式（成功 200 / 失败 500）；整理 agent_tui.log 关键时间线。
- **v3.4 (2026-07-17)**：补齐 SKILL 的「具体题目」与「成长计划」。
- **v3.5 (2026-07-30)**：新增 SQL / Supabase 两个 Tab；"合规认证 / 零信任安全 / 云安全 / 身份权限"四个 placeholder Tab 重写为 46 张带官方标准/文档链接的卡片；page.html 体积扩张至 ~103 KB。
- **v3.6 (2026-07-30)**：SQL/Supabase 30 天学习路径同步入 SKILL.md。
- **v3.7 (2026-07-30)**：新增 JavaScript / TypeScript 两个 Tab（各 16 张卡）。
- **v3.8 (2026-08-14)**：服务自检 + 重启；整理 `logs/agent_tui.log` 25,692 行的最后 3 轮对话；新增 8082 `/ask/claude` 系统提示词章节；新增简历 → OBS 上传章节；清理 `uploads/` 下 37 个旧 `.tmp.*` 残留。
- **v3.8.1 (2026-08-14)**：tmpfile 四段式提示词瘦身 — 无文件时不输出【文件提示词】段；SKILL.md 切片（`getSkillMinimal()` 只取 3 节）；历史对话 5 行简要（每行 80 字符 + 时间戳）；`/api/claude-sse` 修复重复前缀 bug；图文模式（`CLAUDE_IMG=1` + `tmp.png`）。
- **v3.8.2 (2026-08-14)**：SKILL.md 精简到 < 1000 字（411 CJK），细节搬至 `docs/PROJECT_DETAILS.md`。

## 6. 30 天学习路径（JS / TS / SQL / Supabase / Modbus TCP）

完整每日学习计划（day 1 - day 30：技能点 + 面试题 + 资源链接）已包含在原 SKILL.md v3.7 备份中。如需查阅：

- JS: MDN 官方文档 + javascript.info
- TS: typescriptlang.org 官方手册 + DefinitelyTyped
- SQL: PostgreSQL 官方文档 + Mode Analytics SQL 教程
- Supabase: supabase.com/docs
- Modbus TCP: modbus.org 官方规范 + libmodbus 源码

具体题目 / 链接清单见 git log `v3.7` 标签的 SKILL.md。

## 7. 8082 `/ask/claude` 系统提示词

详见 `systemreadme.md` 核心二，关键点：
- 端口 8082，端点 `/ask/claude` 和 `/health`
- 参数智能编码识别：含空格或长度 < 50 → URL 解码；其他 → base64
- 响应格式：成功 200 纯文本，失败 500 错误信息
- 给容器外的其他服务（如 Tools Hub）调用

## 8. OBS 文件上传通道

- 端点：`http://obs.dimond.top`
- 协议：HTTP PUT（仅根路径，不支持子目录）
- 流程：本地写新文件 → curl PUT → 验证 201 → 删除本地旧文件 → 删除 OBS 旧文件
- META 头格式（写入文件首行）：`# META: {date, time, session_id, summary, source, corrects}`
- 典型用例：用户简历整理后的 txt 文件上传
