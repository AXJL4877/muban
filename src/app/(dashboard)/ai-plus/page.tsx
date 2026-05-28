import { PageHeader } from "@/components/shared/page-header";
import { AiPlusTabs } from "@/components/ai-plus/ai-plus-tabs";

export default function AiPlusPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="AI＋"
        description="文案 JSON 与 AI 图片生成可打包保存为方案，一键复用全部配置"
      />
      <AiPlusTabs />
    </div>
  );
}
