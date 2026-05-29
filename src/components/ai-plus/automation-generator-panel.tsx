"use client";

import Link from "next/link";
import { CheckCircle2, Clock, Play, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { useAutomationRunner } from "@/components/ai-plus/automation-runner-provider";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/motion/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatAutomationDuration } from "@/lib/automation-run-utils";
import { parseTopicLines } from "@/types/automation-run";
import { cn } from "@/lib/utils";

export function AutomationGeneratorPanel() {
  const {
    templates,
    templateId,
    setTemplateId,
    topic,
    setTopic,
    topicBatch,
    setTopicBatch,
    queueItems,
    running,
    steps,
    resultWorkId,
    globalError,
    totalDurationMs,
    savedRun,
    hydrated,
    showContinue,
    resumeStepLabel,
    runFresh,
    runContinue,
    resetRun,
  } = useAutomationRunner();

  const hasTopics =
    topic.trim().length > 0 || parseTopicLines(topicBatch).length > 0;
  const isQueueMode = queueItems.length > 1;

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">自动化模块</CardTitle>
          <CardDescription className="text-xs">
            选择模板并输入主题后自动完成全流程；支持批量主题队列依次执行，每步失败自动重试 2 次
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="automation-template" className="text-xs">
              选择模板
            </Label>
            <select
              id="automation-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={running}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {templates.length === 0 ? (
                <option value="">暂无模板</option>
              ) : (
                templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="automation-topic" className="text-xs">
              单个主题
            </Label>
            <Input
              id="automation-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={running}
              placeholder="例如：初夏轻医美科普海报"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="automation-topic-batch" className="text-xs">
              主题队列（每行一个，优先于单个主题）
            </Label>
            <Textarea
              id="automation-topic-batch"
              value={topicBatch}
              onChange={(e) => setTopicBatch(e.target.value)}
              disabled={running}
              placeholder={"水杨酸\n玻尿酸\n胶原蛋白"}
              className="min-h-[100px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              填写多行时将按顺序轮流执行完整自动化；留空则使用上方单个主题
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {showContinue && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={runContinue}
                disabled={running || !hydrated}
              >
                <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                {resumeStepLabel ? `继续：${resumeStepLabel}` : "继续执行"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetRun}
              disabled={running || !hydrated}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              重置进度
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={runFresh}
              disabled={running || !templateId || !hasTopics || !hydrated}
            >
              {running ? (
                <LoadingSpinner className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              {running
                ? isQueueMode
                  ? "队列执行中…"
                  : "自动化执行中…"
                : parseTopicLines(topicBatch).length > 1
                  ? `开始队列（${parseTopicLines(topicBatch).length} 个主题）`
                  : "开始自动化"}
            </Button>
          </div>

          {running && (
            <p className="text-xs text-primary">
              任务正在后台执行，你可以先去浏览其他模块，顶部会显示实时进度。
            </p>
          )}

          {savedRun && savedRun.status !== "completed" && !running && (
            <p className="text-xs text-muted-foreground">
              后端已保存执行进度（{savedRun.status === "failed" ? "上次失败" : "可继续"}），刷新页面后仍可继续。
            </p>
          )}

          {globalError && (
            <p className="text-xs text-destructive" role="alert">
              {globalError}
            </p>
          )}
          {resultWorkId && (
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              自动导入完成，作品已进入作品管理。
              <Link href="/my-works" className="ml-1 underline">
                查看作品管理
              </Link>
              <Link href={`/image-edit?templateId=${resultWorkId}`} className="ml-2 underline">
                打开编辑
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {isQueueMode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">主题队列</CardTitle>
            <CardDescription className="text-xs">
              按顺序轮流执行，当前主题失败后会自动进入下一个
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {queueItems.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
                  item.status === "running" && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {item.status === "running" && (
                    <LoadingSpinner className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  {item.status === "completed" && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                  )}
                  {item.status === "failed" && (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  {item.status === "pending" && (
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="text-muted-foreground">{index + 1}. </span>
                      {item.topic}
                    </p>
                    {item.error && (
                      <p className="truncate text-xs text-destructive">{item.error}</p>
                    )}
                    {item.resultWorkId && item.status === "completed" && (
                      <Link
                        href={`/image-edit?templateId=${item.resultWorkId}`}
                        className="text-xs text-primary underline"
                      >
                        查看作品
                      </Link>
                    )}
                  </div>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {item.status === "pending"
                    ? "等待中"
                    : item.status === "running"
                      ? "执行中"
                      : item.status === "completed"
                        ? "已完成"
                        : "失败"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">执行进度</CardTitle>
          <CardDescription className="text-xs">
            串行执行，前一步成功后才会进入下一步；失败自动重试 2 次，状态自动保存
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {step.status === "running" && (
                  <LoadingSpinner className="h-4 w-4 shrink-0 text-primary" />
                )}
                {step.status === "success" && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                )}
                {step.status === "error" && (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                {step.status === "pending" && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/50" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm">{step.label}</p>
                  {step.error && (
                    <p className="truncate text-xs text-destructive">{step.error}</p>
                  )}
                  {step.retryCount != null && step.retryCount > 0 && step.status === "success" && (
                    <p className="text-xs text-muted-foreground">
                      重试 {step.retryCount} 次后成功
                    </p>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {step.status === "pending"
                  ? "待执行"
                  : step.status === "running"
                    ? "执行中"
                    : formatAutomationDuration(step.durationMs)}
              </p>
            </div>
          ))}
          <div className="pt-1 text-right text-xs text-muted-foreground">
            总耗时：{formatAutomationDuration(totalDurationMs)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
