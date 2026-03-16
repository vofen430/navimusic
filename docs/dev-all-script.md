# `dev-all.js` 启动脚本解析

## 整体作用

通过 `npm run dev:all` 同时启动 **API 后端** 和 **Vite 前端开发服务器**，并统一管理两个进程的生命周期。

## 逐段解析

### 1. 依赖引入

```javascript
const { spawn } = require('child_process')  // 子进程模块，启动新进程
const net = require('net')                   // 网络模块，检测端口占用
const path = require('path')                 // 路径模块
```

- **`spawn`**：创建子进程的低级 API，以流的方式实时转发 stdout/stderr，适合长期运行的服务器进程。

### 2. 端口检测

```javascript
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })
    socket.once('connect', () => { socket.end(); resolve(true) })   // 能连上 → 端口被占用
    socket.once('error', () => { resolve(false) })                   // 连接失败 → 端口空闲
  })
}
```

**原理**：尝试向 `127.0.0.1:3000` 发起 TCP 连接。连接成功说明已有程序监听；失败说明端口空闲。

### 3. 进程启动

```javascript
function startProcess(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,                                    // 工作目录
    stdio: ['ignore', 'inherit', 'inherit'], // stdin 忽略, stdout/stderr 继承
    env: process.env                         // 继承环境变量
  })
}
```

**`stdio` 参数**：

| 位置 | 对应 | 值 | 含义 |
|------|------|----|------|
| `[0]` | stdin | `'ignore'` | 子进程不读取输入 |
| `[1]` | stdout | `'inherit'` | 输出直接显示在父进程终端 |
| `[2]` | stderr | `'inherit'` | 同上 |

其他可选值：`'pipe'`（父进程通过流读取）、文件描述符。

### 4. 退出处理

```javascript
child.on('exit', (code, signal) => {
  if (signal) return                      // 被信号杀死 → 正常关闭
  if (code !== 0) shutdown(code || 1)     // 非零退出码 → 异常，关闭所有进程
})
```

任一子进程异常退出时自动关闭所有进程。

### 5. 优雅关闭

```javascript
process.on('SIGINT', () => shutdown(0))   // Ctrl+C
process.on('SIGTERM', () => shutdown(0))  // kill 命令
```

- **SIGINT**：用户按 Ctrl+C 时发送
- **SIGTERM**：`kill <pid>` 默认信号，可捕获
- **SIGKILL**：`kill -9`，**不可捕获**，操作系统直接杀死

### 6. 主流程

```javascript
async function main() {
  const apiRunning = await isPortInUse(apiPort)
  if (apiRunning) {
    // 复用已有 API 服务器
  } else {
    startProcess('api', process.execPath, ['server.js'], rootDir)
  }
  startProcess('web', npmCommand, ['--prefix', 'frontend', 'run', 'dev'], rootDir)
}
```

- **`process.execPath`**：当前 Node.js 二进制的绝对路径，比硬编码 `'node'` 更可靠
- **`npmCommand`**：`process.platform === 'win32' ? 'npm.cmd' : 'npm'`，处理跨平台差异

## 执行流程

```
npm run dev:all
    │
    ▼
node scripts/dev-all.js
    │
    ├─ 检测 port 3000
    │   ├─ 已占用 → 跳过，复用现有 API server
    │   └─ 空闲   → spawn('node', ['server.js'])  ← 子进程 1
    │
    ├─ spawn('npm', ['--prefix', 'frontend', 'run', 'dev'])  ← 子进程 2
    │
    └─ 监听 SIGINT/SIGTERM
        └─ Ctrl+C → kill 子进程 1 & 2 → exit
```

## `spawn` vs `exec` vs `fork`

| 方法 | 输出方式 | 适用场景 |
|------|---------|---------|
| `spawn` | 流式（实时） | 长期运行的进程（服务器） |
| `exec` | 缓冲（结束后一次性返回） | 短命令（`ls`, `git status`） |
| `fork` | 同 spawn + 内置 IPC 通道 | Node.js 子进程间通信 |
