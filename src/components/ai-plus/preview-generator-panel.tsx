"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, ImageIcon, Pencil, PencilOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/motion/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { parseAiJsonOutput, stashAiCanvasImport } from "@/lib/apply-ai-json-to-canvas";
import { embedBlobUrlsInCanvasJson } from "@/lib/canvas-persist";
import { loadAiPlusState, subscribeAiPlusJsonOutput } from "@/lib/ai-plus-storage";
import {
  AI_PLUS_IMAGE_STORAGE_KEY,
  loadAiPlusImageState,
  subscribeAiPlusImageState,
} from "@/lib/ai-plus-image-storage";
import { composeAiPlusCanvasJson } from "@/lib/ai-plus-compose";
import { loadStoredKeyConfigs, mergeKeyConfigsWithElements } from "@/lib/ai-template-keys";
import { loadTemplateLibrary, saveTemplate } from "@/lib/image-templates";
import { getImageZonesForTemplate } from "@/lib/template-image-zones";
import {
  TemplateImagePreview,
  type TemplateImagePreviewHandle,
} from "@/components/ai-plus/template-image-preview";
import type { SavedImageTemplate } from "@/types/image-template";

export function PreviewGeneratorPanel() {
  const router = useRouter();
  const previewRef = useRef<TemplateImagePreviewHandle>(null);
  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [mounted, setMounted] = useState(false);
  const [editable, setEditable] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setTemplates(await loadTemplateLibrary());
      setMounted(true);
    })();
  }, []);

  const jsonLastOutput = useSyncExternalStore(
    subscribeAiPlusJsonOutput,
    () => loadAiPlusState().lastOutput,
    () => ""
  );
  const imageStateSnapshot = useSyncExternalStore(
    subscribeAiPlusImageState,
    () => {
      if (typeof window === "undefined") return "";
      return window.localStorage.getItem(AI_PLUS_IMAGE_STORAGE_KEY) ?? "";
    },
    () => ""
  );
  const imageState = useMemo(() => {
    if (!imageStateSnapshot) return loadAiPlusImageState();
    try {
      const parsed = JSON.parse(imageStateSnapshot) as Partial<
        ReturnType<typeof loadAiPlusImageState>
      >;
      return { ...loadAiPlusImageState(), ...parsed };
    } catch {
      return loadAiPlusImageState();
    }
  }, [imageStateSnapshot]);

  const template = useMemo(
    () =>
      imageState.templateId
        ? templates.find((item) => item.id === imageState.templateId) ?? null
        : null,
    [templates, imageState.templateId]
  );
  const zones = useMemo(() => (template ? getImageZonesForTemplate(template) : []), [template]);
  const selectedZone = useMemo(
    () =>
      zones.find((z) => z.elementIndex === imageState.zoneElementIndex) ??
      zones[0] ??
      null,
    [zones, imageState.zoneElementIndex]
  );
  const aiJson = useMemo(
    () => parseAiJsonOutput(jsonLastOutput),
    [jsonLastOutput]
  );
  const keyConfigs = useMemo(() => {
    if (!template) return [];
    return mergeKeyConfigsWithElements(
      template.elements,
      template.jsonPromptConfig?.keyConfigs ??
        (template.id ? loadStoredKeyConfigs(template.id) : undefined)
    );
  }, [template]);

  const canOpenInEditor = !!template;
  const hasComposedResult = !!(template && aiJson && selectedZone && imageState.lastPreviewUrl);

  const handleDownload = useCallback(() => {
    const dataUrl = previewRef.current?.toDataURL();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${template?.name ?? "template"}-${Date.now()}.png`;
    a.rel = "noopener";
    a.click();
  }, [template?.name]);
  const handleDownloadCover = useCallback(() => {
    const src = imageState.lastCoverUrl;
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `${template?.name ?? "cover"}-cover-${Date.now()}.png`;
    a.rel = "noopener";
    a.click();
  }, [imageState.lastCoverUrl, template?.name]);

  const handleOpenInEditor = useCallback(async () => {
    if (!template) {
      setError("请先在图片生成中选择模板");
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const json = await composeAiPlusCanvasJson({
        template,
        keyConfigs,
        aiJson,
        zone: selectedZone,
        generatedImageSrc: imageState.lastPreviewUrl || null,
      });
      const embedded = await embedBlobUrlsInCanvasJson(json);
      const importedWork = await saveTemplate({
        canvasSize: template.canvasSize,
        json: embedded,
        name: `${template.name}（导入）`,
        thumbnail: imageState.lastCoverUrl || undefined,
        recordType: "work",
        jsonPromptConfig: template.jsonPromptConfig,
        imagePromptConfig: template.imagePromptConfig,
      });
      stashAiCanvasImport({
        templateId: importedWork.id,
        canvasSize: importedWork.canvasSize,
        json: embedded,
      });
      router.push(`/image-edit?templateId=${importedWork.id}&fromAi=1`);
    } catch {
      setError("导入到作品失败，请重试");
    } finally {
      setOpening(false);
    }
  }, [
    template,
    keyConfigs,
    aiJson,
    selectedZone,
    imageState.lastPreviewUrl,
    imageState.lastCoverUrl,
    router,
  ]);

  if (!mounted) {
    return <Skeleton className="h-[420px]" />;
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">合成预览</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {editable
                ? "编辑模式：可拖动调整元素"
                : hasComposedResult
                  ? "已合成文案与图片，可直接打开图像编辑微调"
                  : template
                    ? "等待前两块生成结果后自动合成预览"
                    : "请先在图片生成中选择模板"}
            </CardDescription>
          </div>
          {template && (
            <Button
              type="button"
              variant={editable ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 shrink-0"
              title={editable ? "退出编辑" : "编辑预览"}
              aria-label={editable ? "退出编辑" : "编辑预览"}
              aria-pressed={editable}
              onClick={() => setEditable((v) => !v)}
            >
              {editable ? (
                <PencilOff className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {template && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleDownload}
            >
              <Download className="mr-1 h-3 w-3" />
              下载
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 text-xs"
            disabled={!canOpenInEditor || opening}
            onClick={handleOpenInEditor}
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            {opening ? "导入中…" : "导入到作品"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
          <div
            className={cn(
              "relative flex min-h-[360px] flex-1 items-center justify-center overflow-auto rounded-md border bg-muted/20 p-2",
              imageState.lastPreviewUrl && "border-primary/20"
            )}
          >
            {template ? (
              <TemplateImagePreview
                ref={previewRef}
                template={template}
                zone={selectedZone}
                generatedImageSrc={imageState.lastPreviewUrl || null}
                aiJson={aiJson}
                keyConfigs={keyConfigs}
                editable={editable}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10 opacity-40" />
                <span className="text-xs">先完成前两块生成，再在此统一预览与微调</span>
              </div>
            )}
          </div>

          <div className="flex min-h-[360px] flex-col rounded-md border bg-muted/20 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium">封面预览</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                disabled={!imageState.lastCoverUrl}
                onClick={handleDownloadCover}
              >
                <Download className="mr-1 h-3 w-3" />
                下载封面
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded border bg-background/70">
              {imageState.lastCoverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageState.lastCoverUrl}
                  alt="封面预览"
                  className="max-h-[320px] w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <span className="text-xs">暂无封面，请先在图片生成中点击“生成封面”</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
