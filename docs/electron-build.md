# CloudMusic Electron 编译指南

## 📦 快速编译命令

### 前提条件（Windows）

```bash
# 1. 安装依赖（首次）
npm install

# 2. 重编译原生模块给 Electron（首次 / Electron 版本变化后）
npm run electron:rebuild
```

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

### 依赖说明

`ffi-napi` 和 `ref-napi` 为**可选依赖**（`optionalDependencies`）：
- Windows 上会自动安装，用于 WorkerW API 调用
- Linux/macOS 上安装失败不影响其他功能
