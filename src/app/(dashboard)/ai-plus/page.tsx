import { PageHeader } from "@/components/shared/page-header";
import { JsonGeneratorPanel } from "@/components/ai-plus/json-generator-panel";

export default function AiPlusPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="AI＋"
        description="提示词自动保存；生成后可一键带入图像编辑"
      />
      <JsonGeneratorPanel />
    </div>
  );
}
