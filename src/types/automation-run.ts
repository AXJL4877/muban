export type AutomationStepId = "json" | "image" | "cover" | "import";

export type AutomationStepStatus = "pending" | "running" | "success" | "error";

export type AutomationRunStatus = "idle" | "running" | "failed" | "completed";

export type AutomationQueueItemStatus = "pending" | "running" | "completed" | "failed";

/** 每个自动化步骤失败后的自动重试次数 */
export const AUTOMATION_MAX_RETRIES = 2;

export interface AutomationStepRecord {
  id: AutomationStepId;
  label: string;
  status: AutomationStepStatus;
  durationMs: number | null;
  error: string | null;
  /** 该步骤已执行的重试次数（不含首次） */
  retryCount?: number;
}

export interface AutomationQueueItem {
  id: string;
  topic: string;
  status: AutomationQueueItemStatus;
  resultWorkId?: string;
  error?: string;
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
  /** 批量主题队列 */
  queue?: AutomationQueueItem[];
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

export function createAutomationRun(
  templateId: string,
  topic: string,
  queue?: AutomationQueueItem[]
): AutomationRunState {
  const now = Date.now();
  return {
    templateId,
    topic: topic.trim(),
    status: "running",
    steps: buildDefaultAutomationSteps(),
    queue,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseTopicLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildQueueItems(topics: string[]): AutomationQueueItem[] {
  return topics.map((t, index) => ({
    id: `queue-${Date.now()}-${index}`,
    topic: t,
    status: "pending" as const,
  }));
}
