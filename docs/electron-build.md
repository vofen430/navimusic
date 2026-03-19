# CloudMusic Electron 编译指南

## 📦 快速编译命令

### 前提条件（Windows）

```bash
# 1. 安装依赖（首次）— ffi-napi 和 ref-napi 是标准依赖
npm install

# 2. 重编译原生模块给 Electron（首次 / Electron 版本变化后）
#    这一步必须执行，否则 ffi-napi 无法在 Electron 中使用
npm run electron:rebuild
```

> ⚠️ **重要**：`ffi-napi` 和 `ref-napi` 已作为标准依赖安装。
> 执行 `npm install` 后**必须**运行 `npm run electron:rebuild`
> 以确保原生模块与当前 Electron 版本兼容。

### 编译

```bash
# 安装包（.exe NSIS 安装程序，推荐分发）
npm run electron:build

# 免安装版（单文件 portable.exe）
npm run electron:build:portable

# Linux AppImage
npm run electron:build:linux
```

### 开发调试

```bash
# 构建前端 + 以 Electron 运行
npm run electron:dev
```

## 📁 产物位置

```
dist-electron/
├── CloudMusic Setup 1.0.0.exe    # NSIS 安装包
└── CloudMusic-Portable.exe       # 免安装版
```

## 🖥 画境置底模式

在 Electron 环境中运行时，画境模式会多出一个"置底"按钮：
- **Windows**: 使用 WorkerW 技术（Wallpaper Engine 同款）将窗口嵌入桌面层
- **Linux**: 使用 `type: 'desktop'` 窗口类型
- **macOS**: 暂未实现

### 系统托盘

应用启动后始终在系统托盘显示图标，右键菜单包含：
- 显示窗口
- 进入/退出壁纸模式
- 退出 NaviMusic

### 壁纸模式行为

进入壁纸模式后：
- 窗口全屏，嵌入桌面底层（WorkerW）
- 不在任务栏显示
- 不在 Alt+Tab 中显示
- 系统托盘图标始终可见

### 依赖说明

`ffi-napi` 和 `ref-napi` 为**标准依赖**（`dependencies`）：
- Windows 上通过 `npm install` + `npm run electron:rebuild` 安装
- 若编译失败，壁纸模式自动降级为全屏 + 隐藏任务栏（不嵌入桌面层）
