# 🎵 NaviMusic

网易云音乐第三方客户端 — 易于管理歌单、易于发现好歌

![Vue 3](https://img.shields.io/badge/Vue-3.4-42b883) ![Vite](https://img.shields.io/badge/Vite-5-646cff) ![Electron](https://img.shields.io/badge/Electron-33-47848f) ![Node.js](https://img.shields.io/badge/Node.js-18+-339933)

---

## ✨ 特性

- 🎵 **歌单管理** — 浏览、搜索、收藏歌单
- 🔍 **发现音乐** — 每日推荐、排行榜、分类浏览、可点击 Banner（歌曲/专辑/歌单跳转）
- 📻 **私人 FM** — 个性化电台推荐
- 🎤 **实时歌词** — 双语歌词滚动显示
- 🖼️ **智能封面** — 四处封面统一缓存，全局仅一次请求；全屏大图懒加载 + 200px 占位过渡
- 🔮 **3D 封面交互** — 全屏模式鼠标倾斜 + 微凸球面 specular 高光，模拟实物质感
- 💰 **付费检测** — VIP / 付费歌曲自动提示，专辑自动过滤付费曲目
- 🌅 **画境模式** — 可拖拽元素的动态壁纸桌面，支持自定义字体/颜色/阴影
- ✨ **纯净模式** — 极简沉浸式音乐体验
- 🖥 **桌面壁纸** — Electron 模式下可将画境置于桌面最底层（Wallpaper Engine 原理）
- 🌙 **深色/浅色主题**

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9

### 安装

```bash
git clone <repo-url>
cd cloudmusic-api
npm install
cd frontend && npm install && cd ..
```

### 开发运行

```bash
# 同时启动 API 服务 + 前端 dev server
npm run dev:all

# 或分开运行
npm run dev:api    # → http://localhost:3000
npm run dev:web    # → http://localhost:5173
```

浏览器访问 `http://localhost:5173` 即可使用。

---

## 📦 编译为桌面应用 (EXE)

### 前提条件

| 环境 | 说明 |
|---|---|
| Node.js ≥ 18 | 运行时 |
| npm ≥ 9 | 包管理 |
| **Windows**: Visual Studio Build Tools | 编译 `better-sqlite3` 原生模块 |

### 一键编译

```bash
# 1. 安装所有依赖
npm install
cd frontend && npm install && cd ..

# 2. 重编译原生模块（首次 / Electron 版本变化后必须执行）
npm run electron:rebuild

# 3. 编译
npm run electron:build              # NSIS 安装包 (.exe)
npm run electron:build:portable     # 免安装单文件 (NaviMusic-Portable.exe)
npm run electron:build:linux        # Linux AppImage
```

### 产物目录

```
dist-electron/
├── NaviMusic Setup 1.0.0.exe      # Windows NSIS 安装包
├── NaviMusic-Portable.exe         # Windows 免安装版
└── NaviMusic-1.0.0.AppImage       # Linux
```

### 开发调试 (Electron)

```bash
npm run electron:dev
```

> 构建前端 → 启动 API 服务 → 打开 Electron 窗口

---

## 🖥 桌面壁纸模式

在 Electron 中运行时，画境模式和纯净模式的三点菜单提供**「桌面壁纸模式」**选项：

| 平台 | 实现方式 | 状态 |
|---|---|---|
| Windows | WorkerW 子窗口（Wallpaper Engine 原理） | ✅ |
| Linux | `_NET_WM_WINDOW_TYPE_DESKTOP` | ✅ |
| macOS | CGWindowLevel | 🚧 |

> 需要 `ffi-napi` 可选依赖（Windows 自动安装）

---

## 📂 项目结构

```
navimusic/
├── assets/
│   ├── icon.png               # 应用图标
│   ├── fonts/                 # 内置字体
│   └── wallpapers/
│       ├── canvas/            # 画境模式内置壁纸
│       └── pure/              # 纯净模式内置壁纸
├── electron/
│   ├── main.js                # Electron 主进程（含 WorkerW 置底）
│   └── preload.js             # 安全 API Bridge
├── frontend/
│   ├── src/
│   │   ├── components/        # Vue 组件
│   │   ├── views/             # 页面视图
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── composables/       # 组合式函数
│   │   ├── utils/             # 工具函数（slimSong 等）
│   │   └── api/               # API 封装
│   └── dist/                  # 构建产物
├── data/                      # SQLite 数据库
├── docs/                      # 文档
├── scripts/                   # 开发/调试脚本
├── server.js                  # Express API 服务
└── db.js                      # 数据库操作
```

---

## 🛠 全部脚本

| 命令 | 说明 |
|---|---|
| `npm run dev:all` | 同时启动 API + 前端 dev |
| `npm run dev:api` | 仅启动 API 服务 |
| `npm run dev:web` | 仅启动前端 dev server |
| `npm run build` | 构建前端静态文件 |
| `npm run electron:dev` | Electron 开发调试 |
| `npm run electron:build` | 编译 Windows 安装包 |
| `npm run electron:build:portable` | 编译 Windows 免安装版 |
| `npm run electron:build:linux` | 编译 Linux AppImage |
| `npm run electron:rebuild` | 重编译 Electron 原生模块 |
| `node scripts/reset-wallpapers.js` | 重置壁纸图库和种子标志位（开发调试用） |

---

## 📄 License

MIT
