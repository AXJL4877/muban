import { PageHeader } from "@/components/shared/page-header";
import { AiPlusTabs } from "@/components/ai-plus/ai-plus-tabs";

export default function AiPlusPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="AI＋"
        description="文案 JSON 与图片生成配置按模板自动保存，选择模板即可自动加载"
      />
      <AiPlusTabs />
    </div>
  );
}
