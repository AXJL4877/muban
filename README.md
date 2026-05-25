# My Fullstack App

Next.js 全栈项目模板，包含 App Router、Prisma、Tailwind CSS、shadcn/ui 风格组件与 Server Actions。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript (严格模式)
- **样式**: Tailwind CSS v4
- **数据库**: Prisma + SQLite（可切换 PostgreSQL/MySQL）
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

# 初始化数据库
npx prisma migrate dev --name init

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

## 切换到 PostgreSQL

修改 `prisma/schema.prisma` 中 `provider` 为 `postgresql`，并更新 `.env`：

```
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```
