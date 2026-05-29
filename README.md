# My Fullstack App

Next.js 全栈项目模板，包含 App Router、Prisma、Tailwind CSS、shadcn/ui 风格组件与 Server Actions。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript (严格模式)
- **样式**: Tailwind CSS v4
- **数据库**: Prisma + PostgreSQL（Neon，推荐用于 Vercel 部署）
- **UI**: shadcn/ui 风格基础组件

## 目录结构

```
my-fullstack-app/
├── prisma/schema.prisma    # 数据库模型
├── public/                 # 静态资源
├── src/
│   ├── app/                # 路由与页面
│   │   ├── (auth)/         # /login, /register
│   │   ├── (dashboard)/    # /overview + 侧边栏布局
│   │   └── api/users/      # REST API
│   ├── components/ui/      # 基础 UI 组件
│   ├── components/shared/  # 复合组件
│   ├── lib/                # db.ts, utils.ts
│   ├── actions/            # Server Actions
│   ├── hooks/              # 自定义 Hooks
│   └── types/              # TypeScript 类型
├── .env                    # 环境变量（勿提交 Git）
└── tailwind.config.ts
```

## 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库（Neon PostgreSQL，见 .env.example）
cp .env.example .env
# 编辑 .env 填入 Neon 连接串后：
npm run db:migrate

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run db:studio` | Prisma 数据库可视化 |
| `npx prisma migrate dev` | 创建/应用迁移 |

## 路由一览

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/login` | 登录页 |
| `/register` | 注册页（Server Action 示例） |
| `/overview` | 仪表盘 |
| `/api/users` | 用户 REST API |

## 数据库（Neon PostgreSQL）

项目已使用 **PostgreSQL** 持久化模板/作品、公众号配置、自动化状态与自定义字体。复制 `.env.example` 为 `.env` 并填入 [Neon](https://neon.tech) 连接串：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Neon **Direct connection**（主机名不含 `-pooler`） |
| `APP_DATA_ENCRYPTION_KEY` | 加密公众号配置；Vercel **必填** |

本地首次迁移：

```bash
npm run db:migrate
```

若已有 `data/templates.json` 等本地文件，可一键导入 Neon：

```bash
npm run db:import-local
```

## 部署到 Vercel + Neon

### 1. 准备 Neon 数据库

1. 在 [Neon](https://neon.tech) 创建项目
2. 复制 **Direct connection** → `DATABASE_URL`（不要用带 `-pooler` 的连接串）

### 2. 本地配置并迁移（可选：导入旧数据）

```bash
cp .env.example .env
# 编辑 .env 填入 Neon 连接串与 APP_DATA_ENCRYPTION_KEY
npm run db:migrate
npm run db:import-local   # 若有本地 data/ 数据
```

### 3. 推送代码并在 Vercel 部署

```bash
git add .
git commit -m "Deploy with Neon PostgreSQL"
git push
```

在 Vercel **Settings → Environment Variables** 配置：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Neon **Direct connection** |
| `NEXT_PUBLIC_APP_URL` | 如 `https://xxx.vercel.app` |
| `APP_DATA_ENCRYPTION_KEY` | 与本地相同（导入过公众号配置时务必一致） |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 可选 |

构建命令已配置为 `prisma generate && prisma migrate deploy && next build`（见 `vercel.json`）。

### 4. 部署后验证

- 保存模板/作品后刷新，数据应仍在
- 上传自定义字体后刷新，字体应仍可加载
- 微信公众号草稿上传正常

### 持久化说明

| 数据 | 存储位置 |
|------|----------|
| 模板 / 作品 | PostgreSQL `Template` 表 |
| 公众号配置 | PostgreSQL `AppState`（加密） |
| 自动化运行状态 | PostgreSQL `AppState` |
| 自定义字体 | PostgreSQL `CustomFont` 表 |
| 用户账号 | PostgreSQL `User` 表 |
