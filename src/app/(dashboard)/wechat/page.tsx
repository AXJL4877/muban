import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const placeholderArticles = [
  { title: "示例图文一", status: "草稿" },
  { title: "示例图文二", status: "已发布" },
  { title: "示例图文三", status: "定时发布" },
];

export default function WechatPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="微信公众号"
        description="管理图文素材与发布计划（前端占位，待对接公众号 API）"
      />

      <div className="mb-6 flex justify-end">
        <Button disabled>新建图文（待开发）</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>图文列表</CardTitle>
          <CardDescription>最近的内容草稿与已发布文章</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {placeholderArticles.map((article) => (
              <li
                key={article.title}
                className="flex items-center justify-between py-4 text-sm"
              >
                <span className="font-medium">{article.title}</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {article.status}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
