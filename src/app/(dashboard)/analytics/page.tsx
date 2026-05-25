import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="数据分析"
        description="查看关键指标、趋势图表与业务报表（前端占位，待接入数据）"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {["访问量", "转化率", "活跃用户"].map((metric) => (
          <Card key={metric}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{metric}</CardTitle>
              <CardDescription>暂无数据</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>数据图表</CardTitle>
          <CardDescription>图表区域将在接入后端后展示</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground">
            图表占位区域
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
