import { PageHeader } from "@/components/shared/page-header";
import { AiPlusTabs } from "@/components/ai-plus/ai-plus-tabs";

export default function AiPlusPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="AI＋"
        description="文案 JSON 与 AI 图片生成；配置自动保存，JSON 可一键带入图像编辑"
      />
      <AiPlusTabs />
    </div>
  );
}
