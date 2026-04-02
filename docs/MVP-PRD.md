# BG Remover — MVP 需求文档

> 版本: 1.0  
> 日期: 2026-04-02  
> 状态: 开发中

---

## 1. 产品概述

### 1.1 产品定位

BG Remover 是一款免费的在线 AI 图片去背景工具。用户上传任意图片，AI 自动识别主体并移除背景，输出透明背景 PNG，支持一键下载。

### 1.2 目标用户

- 电商卖家（商品白底图/透明图）
- 社媒运营（头像、封面去背景）
- 设计师（快速抠图素材准备）
- 普通用户（日常图片编辑需求）

### 1.3 核心价值

- **零门槛** — 无需注册、无需安装、打开即用
- **秒级处理** — 上传 → 去 → 下载，3 步完成
- **免费起步** — MVP 阶段免费使用
- **隐私安全** — 图片内存处理，不落盘不存储

---

## 2. 功能需求

### 2.1 MVP 功能范围

| # | 功能 | 优先级 | 状态 |
|---|------|--------|------|
| F1 | 图片上传（拖拽 + 点击） | P0 | ✅ 已完成 |
| F2 | AI 去背景处理 | P0 | ✅ 已完成 |
| F3 | 前后对比预览（棋盘格透明区域） | P0 | ✅ 已完成 |
| F4 | 一键下载 PNG | P0 | ✅ 已完成 |
| F5 | 历史记录（localStorage） | P0 | ✅ 已完成 |
| F6 | 格式/大小校验（PNG/JPEG/WebP, ≤10MB） | P0 | ✅ 已完成 |
| F7 | 错误处理与提示 | P0 | ✅ 已完成 |

### 2.2 V2 迭代计划（非 MVP）

| # | 功能 | 优先级 | 说明 |
|---|------|--------|------|
| F8 | 批量处理（多图同时上传） | P1 | 支持一次处理多张图片 |
| F9 | 更换背景（纯色/自定义图片） | P1 | 去背景后可替换为新背景 |
| F10 | API 接口售卖 | P2 | 提供开发者 API，按量计费 |
| F11 | 用户注册与付费套餐 | P2 | 免费额度 + 按次/包月 |
| F12 | 图片裁剪/缩放 | P2 | 基础编辑功能 |
| F13 | 历史记录云端同步 | P3 | 跨设备访问历史 |

### 2.3 功能详细说明

#### F1 — 图片上传

- **拖拽上传**: 拖拽图片到上传区域
- **点击上传**: 点击区域弹出文件选择器
- **支持格式**: PNG、JPEG、WebP
- **文件大小限制**: ≤ 10MB
- **交互反馈**: 拖拽时高亮边框，上传后即时预览

#### F2 — AI 去背景处理

- **触发方式**: 点击 "Remove Background" 按钮
- **处理方式**: 前端发送图片到 `/api/remove-bg`，服务端调用 Remove.bg API
- **图片传输**: 全链路内存传输（FormData → API → ArrayBuffer → Blob），不落盘
- **处理时间**: 通常 3-10 秒（取决于图片大小和网络）
- **进度提示**: 处理中显示 loading spinner + 文案

#### F3 — 前后对比预览

- **布局**: 左右双栏对比（移动端上下排列）
- **原图**: 直接展示上传的图片
- **结果**: 棋盘格背景上展示透明背景 PNG
- **最大高度**: 500px，超出部分等比缩放

#### F4 — 一键下载 PNG

- **触发方式**: 处理完成后出现 "Download PNG" 按钮
- **文件名**: `原文件名-no-bg.png`（如 `photo-no-bg.png`）
- **下载方式**: FileReader 转 base64 data URI → `<a download>` 触发浏览器下载
- **格式**: PNG（透明背景）

#### F5 — 历史记录

- **存储方式**: `localStorage`（键名 `bg-remover-history`）
- **保存内容**: 缩略图（base64, 最大宽度 120px）+ 文件名 + 时间戳
- **最大条数**: 20 条（超出删除最早的）
- **操作**: 逐条删除（hover 显示按钮）、一键清空
- **持久化**: 刷新页面不丢失，但清除浏览器数据会清空

#### F6 — 格式/大小校验

- **上传前校验**: 拒绝非图片文件和超过 10MB 的文件
- **错误提示**: 红色文案提示具体原因
- **服务端校验**: Remove.bg API 自带格式验证

#### F7 — 错误处理

- **网络错误**: "Failed to process image. Please try again."
- **API Key 未配置**: "Remove.bg API key is not configured."
- **API 错误**: 显示 Remove.bg 返回的具体错误信息
- **无效文件**: "No image file provided." / "Invalid file type"

---

## 3. 非功能需求

### 3.1 性能

- 页面首屏加载 < 3 秒
- API 响应时间依赖 Remove.bg（通常 3-10 秒）
- 前端构建产物 < 200KB（gzip 前）

### 3.2 安全

- API Key 仅存服务端环境变量，不暴露给前端
- 图片处理全在内存中，不写入磁盘
- 无用户数据持久化（历史记录仅在用户本地浏览器）
- 无用户认证需求（MVP 阶段）

### 3.3 可用性

- 移动端友好（响应式布局）
- 主流浏览器支持（Chrome、Firefox、Safari、Edge）
- 无障碍基础支持（语义化 HTML）

### 3.4 SEO

- 每页独立 title 和 meta description
- H1/H2 结构清晰
- 关键词覆盖: background remover, remove background, transparent background, 抠图工具, 去背景
- OpenGraph 标签配置

---

## 4. 技术架构

### 4.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 15 + TypeScript | SSR/SSG 支持 |
| UI 样式 | TailwindCSS 4 + 自定义主题 | 原子化 CSS |
| 组件库 | 原生组件（无第三方 UI 库） | MVP 保持轻量 |
| AI 接口 | Remove.bg API v1.0 | 专业抠图服务 |
| 部署平台 | Cloudflare Pages | Edge 部署，全球 CDN |
| 包管理 | npm | — |

### 4.2 系统架构

```
用户浏览器
   │
   ├─ 上传图片 (FormData)
   │
   ▼
Next.js API Route (/api/remove-bg)
   │
   ├─ 转发图片到 Remove.bg API
   │  (X-Api-Key 认证)
   │
   ├─ 接收 PNG 二进制流 (ArrayBuffer)
   │
   ▼
返回 PNG 给前端 (Blob)
   │
   ├─ 生成预览 (Blob URL)
   ├─ 生成下载 (Data URI + <a download>)
   ├─ 生成缩略图 (Canvas → base64) → localStorage
   │
   ▼
用户查看/下载
```

### 4.3 数据流

- **图片流**: 用户上传 → FormData → API → Remove.bg → ArrayBuffer → Blob → 前端
- **历史流**: Blob → Canvas 缩放 → base64 → localStorage
- **下载流**: Blob → FileReader → Data URI → `<a download>` → 浏览器下载

### 4.4 项目结构

```
bg-remover/
├── app/
│   ├── globals.css              # 全局样式 + 棋盘格
│   ├── layout.tsx               # Root Layout + SEO
│   ├── page.tsx                 # 首页（Hero + 工具 + Footer）
│   └── api/
│       └── remove-bg/
│           └── route.ts         # 核心API
├── components/
│   ├── bg-remover.tsx           # 主组件（状态管理 + 对比 + 历史）
│   └── image-uploader.tsx       # 拖拽上传组件
├── .env.local                   # 环境变量（API Key）
├── .env.example                 # 环境变量模板
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

---

## 5. 接口定义

### 5.1 Remove Background API

**POST** `/api/remove-bg`

**Request:**
- Content-Type: `multipart/form-data`
- Body: `image` (File) — PNG/JPEG/WebP, ≤ 10MB

**Response (Success):**
- Status: `200`
- Content-Type: `image/png`
- Body: PNG 二进制流（透明背景）

**Response (Error):**
```json
{
  "error": "Error description"
}
```

| 状态码 | 说明 |
|--------|------|
| 400 | 无图片 / 格式不支持 |
| 500 | API Key 未配置 |
| 502 | Remove.bg API 调用失败 |

### 5.2 依赖外部 API

**Remove.bg API v1.0**
- 端点: `https://api.remove.bg/v1.0/removebg`
- 认证: `X-Api-Key` Header
- 计费: 免费版 50 张/月，Pro 版 $0.09/张
- 限制: 最大 10MB，最长 30 秒超时

---

## 6. 部署方案

### 6.1 开发环境

```bash
npm install
npm run dev          # http://localhost:3000
```

### 6.2 生产部署（Cloudflare Pages）

```bash
# 安装 Cloudflare 适配器
npm install -D @cloudflare/next-on-pages wrangler

# 构建
npx @cloudflare/next-on-pages

# 本地预览
npx wrangler pages dev .vercel/output/static
```

**Cloudflare Dashboard 配置:**
- 构建命令: `npx @cloudflare/next-on-pages`
- 输出目录: `.vercel/output/static`
- 环境变量: `REMOVE_BG_API_KEY`

### 6.3 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `REMOVE_BG_API_KEY` | ✅ | Remove.bg API 密钥 |

---

## 7. 测试计划

### 7.1 功能测试

| 场景 | 预期结果 |
|------|----------|
| 上传 PNG 图片 | 正常预览，显示 Remove Background 按钮 |
| 上传 JPEG 图片 | 正常预览 |
| 上传 WebP 图片 | 正常预览 |
| 上传非图片文件 | 提示 "Please upload a PNG, JPEG, or WebP image." |
| 上传 > 10MB 文件 | 提示 "Image must be under 10MB." |
| 点击 Remove Background | 显示 loading → 显示结果图 |
| 点击 Download PNG | 浏览器直接下载 PNG 文件 |
| 点击 New Image | 清空当前状态，回到上传界面 |
| 去背景后查看历史 | 新增一条记录，缩略图+文件名+时间 |
| 删除历史条目 | 对应记录消失 |
| 清空历史 | 所有记录消失 |
| 刷新页面 | 历史记录仍然存在 |

### 7.2 兼容性测试

- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+
- iOS Safari
- Android Chrome

### 7.3 性能测试

- 首屏 LCP < 3 秒
- JS 包体积 < 200KB（gzip 前）
- 大图片（10MB）处理不崩溃

---

## 8. 里程碑

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| **M1 — MVP 完成** | F1~F7 全部功能，本地可运行 | ✅ 已完成 |
| **M2 — 线上部署** | 部署到 Cloudflare Pages，绑定域名 | 待开始 |
| **M3 — V2 功能** | 批量处理 + 更换背景 | 待规划 |
| **M4 — 商业化** | 用户系统 + 付费套餐 + API 售卖 | 待规划 |

---

## 9. 风险与限制

| 风险 | 影响 | 缓解方案 |
|------|------|----------|
| Remove.bg 免费额度耗尽 | 无法处理新请求 | 升级 Pro / 接入备用 API（Replicate rembg） |
| Remove.bg 服务宕机 | 功能不可用 | 降级提示 + 备用 API 切换 |
| 大图片处理超时 | 用户体验差 | 前端超时提示 + 建议缩小图片 |
| Cloudflare Pages 对 Next.js 兼容性 | 部署失败 | 使用 `@cloudflare/next-on-pages` 适配 |
| localStorage 空间不足（约 5MB） | 历史记录保存失败 | 超限时自动清理旧记录 / 提示用户 |

---

*文档维护人: 玄离 ⚡*
