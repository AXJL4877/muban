"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Workflow } from "lucide-react";
import { useAutomationRunner } from "@/components/ai-plus/automation-runner-provider";
import { LoadingSpinner } from "@/components/motion/loading-spinner";
import {
  countCompletedAutomationSteps,
  countQueueCompleted,
  getActiveAutomationStepLabel,
  getActiveQueueItem,
  hasAutomationQueue,
} from "@/lib/automation-run-utils";
import { saveAiPlusUiState } from "@/lib/ai-plus-ui-storage";
import { cn } from "@/lib/utils";

export function AutomationGlobalBanner() {
  const pathname = usePathname();
  const { running, savedRun, steps, queueItems } = useAutomationRunner();

  const visible =
    running || savedRun?.status === "running" || savedRun?.status === "failed";

  if (!visible || !savedRun) return null;

  const completed = countCompletedAutomationSteps(steps);
  const total = steps.length;
  const activeLabel = getActiveAutomationStepLabel(steps);
  const onAiPlusPage = pathname === "/ai-plus";
  const isQueue = hasAutomationQueue(savedRun) || queueItems.length > 1;
  const queueCompleted = countQueueCompleted(queueItems);
  const activeQueueItem = getActiveQueueItem(queueItems);

  const statusText = running
    ? isQueue && activeQueueItem
      ? `队列 ${queueCompleted + 1}/${queueItems.length}：${activeQueueItem.topic}${activeLabel ? ` · ${activeLabel}` : ""}`
      : activeLabel
        ? `正在执行：${activeLabel}`
        : "自动化执行中"
    : savedRun.status === "failed"
      ? isQueue
        ? `队列部分失败（${queueCompleted}/${queueItems.length}），可返回继续`
        : "自动化执行失败，可返回继续"
      : isQueue
        ? `队列待继续（${queueCompleted}/${queueItems.length}）`
        : "自动化待继续";

  return (
    <div
      className={cn(
        "border-b px-4 py-2.5 text-sm",
        running
          ? "border-primary/20 bg-primary/5"
          : savedRun.status === "failed"
            ? "border-destructive/20 bg-destructive/5"
            : "border-muted bg-muted/30"
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-foreground">
          {running ? (
            <LoadingSpinner className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">
            {statusText}
            <span className="ml-2 text-muted-foreground">
              ({completed}/{total})
            </span>
          </span>
        </div>
        {!onAiPlusPage && (
          <Link
            href="/ai-plus"
            onClick={() => saveAiPlusUiState({ activeTab: "automation" })}
            className="shrink-0 text-primary underline-offset-4 hover:underline"
          >
            查看自动化进度
          </Link>
        )}
      </div>
    </div>
  );
}
