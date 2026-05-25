import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Database, Layers, Zap } from "lucide-react";

const features = [
  {
    icon: Layers,
    title: "App Router",
    description: "基于 Next.js App Router，路由分组清晰，前后端一体。",
  },
  {
    icon: Database,
    title: "Prisma ORM",
    description: "类型安全的数据库访问，schema 即文档。",
  },
  {
    icon: Zap,
    title: "Server Actions",
    description: "无需手写 API 即可完成表单提交与数据变更。",
  },
];

export default function HomePage() {
  return (
    <div className="container mx-auto flex flex-1 flex-col items-center px-4 py-16">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          全栈项目模板
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Next.js 16 · TypeScript · Tailwind CSS · Prisma · shadcn/ui 风格组件
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/register">
              开始使用
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/overview">查看仪表盘</Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>

      <section className="mt-16 rounded-lg border bg-muted/50 p-6 text-sm text-muted-foreground">
        <p>
          API 示例：<code className="rounded bg-muted px-1.5 py-0.5">GET /api/users</code>
          {" · "}
          页面：<code className="rounded bg-muted px-1.5 py-0.5">/login</code>
          {" "}
          <code className="rounded bg-muted px-1.5 py-0.5">/register</code>
          {" "}
          <code className="rounded bg-muted px-1.5 py-0.5">/overview</code>
        </p>
      </section>
    </div>
  );
}
