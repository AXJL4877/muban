import type {
  AutomationQueueItem,
  AutomationRunState,
  AutomationStepId,
  AutomationStepRecord,
  AutomationStepStatus,
} from "@/types/automation-run";

export function formatAutomationDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function isAutomationStepDone(status: AutomationStepStatus): boolean {
  return status === "success";
}

export function firstIncompleteAutomationStep(
  steps: AutomationStepRecord[]
): AutomationStepId | null {
  const step = steps.find((item) => !isAutomationStepDone(item.status));
  return step?.id ?? null;
}

export function canContinueAutomationRun(run: AutomationRunState | null): boolean {
  if (!run) return false;
  if (run.status === "completed") return false;
  if (run.queue && run.queue.length > 1) {
    const hasResumable = run.queue.some(
      (item) =>
        item.status === "pending" || item.status === "running" || item.status === "failed"
    );
    if (hasResumable) return true;
  }
  return firstIncompleteAutomationStep(run.steps) !== null;
}

export function countCompletedAutomationSteps(steps: AutomationStepRecord[]): number {
  return steps.filter((step) => isAutomationStepDone(step.status)).length;
}

export function getActiveAutomationStepLabel(
  steps: AutomationStepRecord[]
): string | null {
  const running = steps.find((step) => step.status === "running");
  if (running) return running.label;
  const nextId = firstIncompleteAutomationStep(steps);
  if (!nextId) return null;
  return steps.find((step) => step.id === nextId)?.label ?? null;
}

export function countQueueCompleted(items: AutomationQueueItem[]): number {
  return items.filter((item) => item.status === "completed").length;
}

export function getActiveQueueItem(
  items: AutomationQueueItem[]
): AutomationQueueItem | null {
  return items.find((item) => item.status === "running") ?? null;
}

export function firstResumableQueueIndex(items: AutomationQueueItem[]): number {
  const index = items.findIndex(
    (item) =>
      item.status === "pending" || item.status === "running" || item.status === "failed"
  );
  return index >= 0 ? index : 0;
}

export function hasAutomationQueue(run: AutomationRunState | null): boolean {
  return (run?.queue?.length ?? 0) > 1;
}
