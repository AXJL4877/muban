import { AiSettingsPanel } from "@/components/ai-settings/ai-settings-panel";
import { PageHeader } from "@/components/shared/page-header";

export default function AiSettingsPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="AI设置"
        description="配置 DeepSeek、OpenAI 等模型的 API 密钥、接口地址与默认模型"
      />

      <AiSettingsPanel />
    </div>
  );
}
