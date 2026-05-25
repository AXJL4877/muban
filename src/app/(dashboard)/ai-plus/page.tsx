import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const aiFeatures = [
  { title: "智能对话", description: "与 AI 进行多轮对话，获取创意与解答" },
  { title: "文案生成", description: "一键生成标题、摘要与正文草稿" },
  { title: "内容润色", description: "优化已有文案的语气与表达" },
];

export default function AiPlusPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="AI＋"
        description="AI 增强能力中心：对话、生成与内容辅助（前端占位，待对接模型 API）"
      />

      <div className="mb-6 flex justify-end">
        <Button disabled>
          <Sparkles className="mr-2 h-4 w-4" />
          开始对话（待开发）
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {aiFeatures.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle className="text-base">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" disabled className="w-full">
                即将上线
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
