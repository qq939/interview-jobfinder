#!/bin/bash
# Web app 8082 启动脚本（项目根目录入口）
# 容器启动时会自动执行本文件。
# 日志输出：logs/start.log（项目根目录）
# Web app 代码位于项目根目录（server.js、page.html、package.json、node_modules/）

cd "$(dirname "$0")"

LOG_FILE="logs/start.log"
PID_FILE="$(pwd)/server.pid"
APP_DIR="$(pwd)"
PORT=8082

mkdir -p logs

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "==== user_start.sh 开始执行 ===="
log "工作目录: $APP_DIR"
log "目标端口: $PORT"

# 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
    log "错误: 未找到 node，请先安装 Node.js"
    exit 1
fi
log "Node 版本: $(node --version)"

# 释放端口（如有残留进程）
if command -v lsof >/dev/null 2>&1; then
    PORT_PIDS=$(lsof -ti tcp:${PORT} 2>/dev/null || true)
    if [ -n "$PORT_PIDS" ]; then
        log "释放端口 $PORT 上的进程: $PORT_PIDS"
        echo "$PORT_PIDS" | xargs kill 2>/dev/null || true
        sleep 1
    fi
fi
if command -v fuser >/dev/null 2>&1; then
    fuser -k ${PORT}/tcp 2>/dev/null || true
    sleep 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    log "安装依赖 (npm install)..."
    npm install >> "$LOG_FILE" 2>&1
fi

# 启动 Web app
SERVER_LOG="logs/server_$(date +%Y%m%d_%H%M%S).log"
log "启动 node server.js，日志: $SERVER_LOG"
nohup env PORT=${PORT} ANTHROPIC_DISABLE_PREFLIGHT=1 node server.js >> "$SERVER_LOG" 2>&1 &
NEW_PID=$!
echo $NEW_PID > "$PID_FILE"
log "服务已启动，PID: $NEW_PID"

sleep 2

# 健康检查
if (echo > /dev/tcp/localhost/${PORT}) 2>/dev/null; then
    log "启动成功！访问地址: http://localhost:${PORT}"
else
    log "启动失败，请查看 $SERVER_LOG"
    exit 1
fi

log "==== user_start.sh 执行完成 ===="