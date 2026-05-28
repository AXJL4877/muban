export type AutomationStepId = "json" | "image" | "cover" | "import";

export type AutomationStepStatus = "pending" | "running" | "success" | "error";

export type AutomationRunStatus = "idle" | "running" | "failed" | "completed";

export interface AutomationStepRecord {
  id: AutomationStepId;
  label: string;
  status: AutomationStepStatus;
  durationMs: number | null;
  error: string | null;
}

export interface AutomationRunState {
  templateId: string;
  topic: string;
  status: AutomationRunStatus;
  steps: AutomationStepRecord[];
  jsonText?: string;
  generatedImageSrc?: string;
  generatedCoverSrc?: string;
  resultWorkId?: string;
  globalError?: string | null;
  totalDurationMs?: number | null;
  createdAt: number;
  updatedAt: number;
}

export const AUTOMATION_STEP_ORDER: Array<{ id: AutomationStepId; label: string }> = [
  { id: "json", label: "生成文案 JSON" },
  { id: "image", label: "生成主图" },
  { id: "cover", label: "生成封面" },
  { id: "import", label: "导入到作品管理" },
];

export function buildDefaultAutomationSteps(): AutomationStepRecord[] {
  return AUTOMATION_STEP_ORDER.map((step) => ({
    id: step.id,
    label: step.label,
    status: "pending",
    durationMs: null,
    error: null,
  }));
}

export function createAutomationRun(templateId: string, topic: string): AutomationRunState {
  const now = Date.now();
  return {
    templateId,
    topic: topic.trim(),
    status: "running",
    steps: buildDefaultAutomationSteps(),
    createdAt: now,
    updatedAt: now,
  };
}
