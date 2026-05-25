import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Bot, ImageIcon, LayoutTemplate, MessageSquare, Sparkles } from "lucide-react";
import Link from "next/link";

const quickLinks = [
  {
    href: "/analytics",
    title: "数据分析",
    description: "查看业务数据与统计报表",
    icon: BarChart3,
  },
  {
    href: "/image-edit",
    title: "图像编辑",
    description: "处理与编辑图片素材",
    icon: ImageIcon,
  },
  {
    href: "/ai-plus",
    title: "AI＋",
    description: "AI 对话、文案生成与智能助手",
    icon: Sparkles,
  },
  {
    href: "/wechat",
    title: "微信公众号",
    description: "管理公众号内容与发布",
    icon: MessageSquare,
  },
  {
    href: "/my-templates",
    title: "我的模板",
    description: "查看图像编辑保存的作品与元素属性",
    icon: LayoutTemplate,
  },
  {
    href: "/ai-settings",
    title: "AI设置",
    description: "配置 AI 模型与相关参数",
    icon: Bot,
  },
] as const;

export default function HomePage() {
  return (
    <div className="p-8">
      <PageHeader
        title="欢迎回来"
        description="从左侧边栏或下方快捷入口进入各功能模块"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group block">
            <Card className="transition-colors hover:border-primary/30 hover:bg-muted/30">
              <CardHeader>
                <Icon className="mb-2 h-8 w-8 text-primary transition-transform group-hover:scale-105" />
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
