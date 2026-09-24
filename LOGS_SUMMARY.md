# Agent TUI 日志整理

## 项目概述

**项目名称**: 字节跳动·面试题直通车 + AI简历面试助手
**端口**: 8082
**目录**: /home/agent/.claude/workspace/project
**启动脚本**: user_start.sh

## 项目构建历程

### 阶段1：基础功能（2026-04-20 ~ 2026-04-22）
- 创建基础聊天功能
- 添加面试题卡片展示
- 实现文件上传功能
- 解决 nginx 反代理路径问题

### 阶段2：Claude CLI 集成（2026-04-22 ~ 2026-04-30）
- 从 API 方式改为 Claude CLI 调用
- 使用 `child_process.spawn` 调用 Claude CLI
- 添加 `--continue` 参数保持会话连贯
- 修复用户提示词传递问题

### 阶段3：SSE 流式响应（2026-05-01 ~ 2026-05-03）
- 实现 Server-Sent Events 流式响应
- 添加 localStorage 客户端持久化
- 服务器端会话暂存
- 添加 Playwright 测试脚本

### 阶段4：AI助手tab重构（2026-05-04）
- **tmpFile 格式**：用户提示词 + SKILL.md职责 + 文件提示词 + 用户提示词（重复）
- **对话持久化**：统一保存在 `uploads/dialogs/` 目录
- **SSE 推流**：实时返回 AI 回复
- **历史对话**：默认显示最近 5 轮对话
- **多端同步**：服务器端统一管理对话

### 阶段5：BOSS直聘岗位挖掘（2026-05-04）
- `boss_job_page.js`: Playwright JS 版抓取脚本
- `boss_job_scraper.py`: Python 版抓取脚本
- Stealth 模式绕过自动化检测
- 移动端视口模拟

## 主要功能模块

### 1. AI助手tab
- **前端**: page.html - 对话界面、文件上传、tmpfile实时显示
- **后端**: server.js - Claude CLI调用、SSE推流、对话持久化
- **tmpFile格式**:
  ```
  【用户问题】
  {用户输入}

  ---

  {SKILL.md 职责部分}

  ---

  【文件提示词】
  （有文件时）：我已经把文件上传至项目根目录，文件名：xxx。
  （无文件时）：请在项目根目录中寻找文件解答我的问题...

  ---

  【用户问题】
  {用户输入}  ← 用户问题重复
  ```

### 2. 面试题卡片
- 按岗位分类展示（后端、客户端、前端、算法岗、测试岗）
- LeetCode 刷题链接
- 高频题目标注

### 3. BOSS直聘岗位挖掘
- Stealth 模式绕过检测
- 提取：岗位名、薪资、公司、技能标签等

## 遇到的问题及解决方案

### 1. spawn ps ENOENT
- **原因**: 精简版Linux没有ps命令
- **解决**: 使用 `kill -0` 替代 `ps` 检查进程

### 2. nginx 404 反代问题
- **原因**: 前端使用绝对路径 `/api/claude`
- **解决**: 改为相对路径 `api/claude`

### 3. 发送按钮点击无效
- **原因**: HTML压缩后onclick事件丢失
- **解决**: 使用显式绑定 `onclick="sendMessage()"`
- **验证**: Playwright测试通过

### 4. Playwright PATH 问题
- **原因**: node_modules/.bin不在PATH中
- **解决**: 使用 `npx playwright` 或设置 PATH

### 5. SSE 连接错误
- **原因**: EventSource只支持GET，同时fetch POST冲突
- **解决**: 改用 fetch + ReadableStream 读取SSE流

## 最后3轮对话内容

### 第1轮：Bug修复 - 发送按钮、历史记录、tmpfile
**时间**: 2026-05-05 00:23:07
**用户要求**: 修复发送按钮点不动、历史记录消失、tmpfile不显示

**修复内容**:
1. **发送按钮**:
   - 删除重复的 `startTmpFilePolling()` 调用
   - 将 `response` 和 `reader` 变量移到 try 块外层
   - finally 块确保 `setLoading(false)` 总是被调用
2. **历史记录消失**: 在 finally 块添加 `loadHistory()` 调用
3. **tmpfile不显示**: 添加 `/uploads/*` 静态文件路由

### 第2轮：确认tmpfile路径和结构
**时间**: 2026-05-05 00:48:54 ~ 00:54:37
**用户要求**: 确认tmpfile保存在 `uploads/` 目录，结构中用户问题需要重复

**修复内容**:
1. 确认 tmpfile 路径：`/home/agent/.claude/workspace/project/uploads/tmpfile.txt`
2. 更新 tmpfile 结构，用户问题重复（开头+末尾）
3. 服务器添加 uploads 静态文件路由

### 第3轮：当前对话 - 项目维护
**时间**: 2026-05-05 01:04:24
**用户要求**: 检查启动脚本、完善文档、整理日志、总结对话

**完成情况**:
- ✅ user_start.sh 已存在且完善
- ✅ README.md 已更新（tmpFile格式、版本记录）
- ✅ SKILL.md 已完善（tmpFile格式、工作流程）
- ✅ LOGS_SUMMARY.md 已整理
- ✅ 最后3轮对话已总结

## 本次修复的Bug

| Bug | 原因 | 解决方案 |
|-----|------|----------|
| 发送按钮点击不动 | `startTmpFilePolling()`重复调用、response变量作用域问题 | 删除重复调用、变量外移 |
| 历史记录消失 | finally块中未调用loadHistory() | finally块添加loadHistory() |
| tmpfile不显示 | 服务器无uploads静态路由 | 添加`/uploads/*`路由 |
| tmpfile结构缺失 | 用户问题未重复 | 结构中添加用户问题重复 |

## 当前服务状态

- **服务运行**: 是
- **端口**: 8082
- **启动脚本**: /home/agent/.claude/workspace/project/user_start.sh
- **日志输出**: logs/start.log

## Git 提交历史

| Commit | 说明 |
|--------|------|
| f3e4b36 | fix: 修复测试脚本，添加 PATH 环境变量说明 |
| c498a23 | fix: 修复SSE超时和连接错误 |
| 0af6472 | feat: AI助手tab重构 - 对话持久化、SSE推流、岗位挖掘脚本 |
| a512d47 | 解决了nginx反代理相对目录、主机信任和跨域的问题 |

## 2026-05-05 测试数据隔离

- 生产服务继续通过 spawn('claude', ...) 调用真实 Claude CLI。
- Playwright E2E 使用临时 JOBFINDER_DATA_DIR 和临时 fake claude PATH，避免测试对话写入生产 uploads/dialogs。

## 2026-05-05 修复模拟回复污染问题

### 问题描述

线上 AI 助手出现 "模拟回复完成：AI助手发送链路正常" 的问题，原因是测试进程的 fake claude 残留污染了线上环境。

### 根因分析

1. **测试文件 `tests/app.spec.js`** 使用 fake claude 模拟 AI 回复
2. **fakeBinDir** 使用 `fs.mkdtempSync` 创建在系统临时目录（如 `/tmp/jobfinder-e2e-xxxxxx/`）
3. **PATH 修改**：测试启动时设置 `PATH: fakeBinDir + path.delimiter + process.env.PATH`
4. **清理不彻底**：原来的 `afterAll` 使用 `serverProcess.kill()` 可能进程未完全退出，导致 fake claude 残留

### 修复措施

1. **增强 afterAll 清理逻辑**：
   - 发送 SIGTERM 信号优雅停止
   - 等待进程退出（最多5秒）
   - 使用 `fs.rmSync(..., { force: true })` 确保清理

2. **添加测试隔离说明注释**：
   ```javascript
   /**
    * 【重要】fake claude 隔离说明：
    * - fake claude 只在测试进程内使用，通过修改 PATH 环境变量实现
    * - 临时目录 fakeBinDir 使用 mkdtempSync 创建在系统临时目录中
    * - 测试结束后，afterAll 会清理临时目录
    * - fake 只影响测试服务器进程（端口 8999），不影响线上服务（端口 8082）
    */
   ```

3. **更新 README.md**：添加 "Fake Claude 测试隔离机制" 章节

### 验证结果

- ✅ 线上服务（端口 8082）使用真实 claude
- ✅ 对话历史确认不是模拟回复
- ✅ tmpfile.txt 正常生成
- ✅ 测试进程使用不同端口（8999），与线上隔离

### 变更文件

- `tests/app.spec.js` - 增强清理逻辑
- `README.md` - 添加测试隔离说明

### 注意事项

- **fake claude 只在测试进程内使用**
- **临时目录使用系统临时目录，不污染项目根目录**
- **进程级隔离：测试用端口 8999，线上用端口 8082**
