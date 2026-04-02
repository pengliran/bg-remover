# BG Remover

Free online AI-powered background removal tool.

## Setup

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 Remove.bg API Key
```

## Environment Variables

```env
# Remove.bg API Key (必填)
# 申请地址: https://www.remove.bg/api
REMOVE_BG_API_KEY=your_api_key_here
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Cloudflare Pages

### 方式一: 使用 @cloudflare/next-on-pages (推荐)

```bash
# 安装 Cloudflare 适配器
npm install -D @cloudflare/next-on-pages wrangler

# 构建
npx @cloudflare/next-on-pages

# 本地预览
npx wrangler pages dev .vercel/output/static
```

### 方式二: 直接部署

在 Cloudflare Dashboard 中：
1. 连接 Git 仓库
2. 构建命令: `npx @cloudflare/next-on-pages`
3. 输出目录: `.vercel/output/static`
4. 环境变量: 添加 `REMOVE_BG_API_KEY`

## 架构

- **图片处理**: 全链路内存传输，不落盘
- **前端**: Next.js + TailwindCSS，棋盘格预览透明区域
- **API**: Next.js Route Handler → Remove.bg API
- **部署**: Cloudflare Pages (Edge)
