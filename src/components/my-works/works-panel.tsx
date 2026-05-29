"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, ImageIcon, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import { Skeleton, SkeletonGroup } from "@/components/motion/skeleton";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteTemplateByType,
  loadWorksLibrary,
  renameTemplateByType,
} from "@/lib/image-templates";
import {
  extractWorkImages,
  extractWorkPromptSections,
  formatWorkTextJson,
  summarizeCanvasJson,
} from "@/lib/work-assets";
import { cn, formatDate } from "@/lib/utils";
import { hoverLift, tapScale, transitions } from "@/lib/motion";
import type { SavedImageTemplate } from "@/types/image-template";

function getWorkCoverSrc(work: SavedImageTemplate): string | null {
  if (work.thumbnail) return work.thumbnail;
  const images = extractWorkImages(work);
  return images[0]?.src ?? null;
}

function PromptBlock({
  title,
  lines,
}: {
  title: string;
  lines: Array<{ label: string; value: string }>;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/15 p-2.5">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <div className="space-y-1.5">
        {lines.map((line) => (
          <div key={`${title}-${line.label}`} className="text-xs">
            <p className="text-muted-foreground">{line.label}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
              {line.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkCompactCard({
  work,
  onClick,
  onDelete,
}: {
  work: SavedImageTemplate;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const coverSrc = useMemo(() => getWorkCoverSrc(work), [work]);

  return (
    <motion.div
      whileTap={tapScale}
      whileHover={hoverLift}
      transition={transitions.springSoft}
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 flex-col text-left"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={work.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" />
              <span className="text-xs">无封面</span>
            </div>
          )}
        </div>
        <div className="border-t px-3 py-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{work.name}</p>
        </div>
      </button>
      <button
        type="button"
        aria-label={`删除作品「${work.name}」`}
        title="删除作品"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(work.id);
        }}
        className={cn(
          "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md",
          "border border-border/60 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm",
          "opacity-0 transition-opacity hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
          "group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

function WorkDetailView({
  work,
  onBack,
  onDelete,
  onRename,
}: {
  work: SavedImageTemplate;
  onBack: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editingName, setEditingName] = useState(work.name);
  const images = useMemo(() => extractWorkImages(work), [work]);
  const textJson = useMemo(() => formatWorkTextJson(work), [work]);
  const promptSections = useMemo(() => extractWorkPromptSections(work), [work]);
  const canvasJsonPreview = useMemo(() => summarizeCanvasJson(work.json), [work.json]);

  useEffect(() => {
    setEditingName(work.name);
  }, [work.name]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          返回列表
        </Button>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/image-edit?templateId=${work.id}`}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              在编辑器中打开
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(work.id)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            删除作品
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={() => {
              if (editingName.trim() && editingName !== work.name) {
                onRename(work.id, editingName);
              }
            }}
            className="h-10 max-w-xl text-base font-semibold"
          />
          <CardDescription>
            保存于 {formatDate(new Date(work.savedAt))} · 画布 {work.canvasSize.width} ×{" "}
            {work.canvasSize.height} · {work.elementCount} 个元素
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">全部图片</p>
            {images.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="w-36 overflow-hidden rounded-lg border bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.src}
                      alt={image.label}
                      className="aspect-square w-full object-cover"
                    />
                    <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                      {image.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无图片资源</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">文案 JSON</p>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed">
              {textJson}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">提示词</p>
            {promptSections.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {promptSections.map((section) => (
                  <PromptBlock key={section.title} title={section.title} lines={section.lines} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">该作品未保存提示词配置</p>
            )}
          </div>

          <details className="rounded-lg border bg-muted/10">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
              画布完整 JSON
            </summary>
            <pre className="max-h-96 overflow-auto border-t p-4 text-xs leading-relaxed">
              {canvasJsonPreview}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorksPanel() {
  const [works, setWorks] = useState<SavedImageTemplate[]>([]);
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedWork = useMemo(
    () => (selectedId ? works.find((work) => work.id === selectedId) ?? null : null),
    [works, selectedId]
  );

  const refresh = useCallback(() => {
    void (async () => {
      setWorks(await loadWorksLibrary());
    })();
  }, []);

  useEffect(() => {
    refresh();
    setMounted(true);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const handleDelete = useCallback(
    (id: string) => {
      void (async () => {
        if (!confirm("确定删除该作品？此操作不可恢复。")) return;
        await deleteTemplateByType(id, "work");
        setSelectedId((prev) => (prev === id ? null : prev));
        refresh();
      })();
    },
    [refresh]
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      void (async () => {
        await renameTemplateByType(id, name, "work");
        refresh();
      })();
    },
    [refresh]
  );

  if (!mounted) {
    return (
      <div className="p-8">
        <PageHeader title="作品管理" description="加载中…" />
        <SkeletonGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </SkeletonGroup>
      </div>
    );
  }

  if (selectedWork) {
    return (
      <div className="p-8">
        <PageHeader title="作品详情" description={selectedWork.name} />
        <FadeIn>
          <WorkDetailView
            work={selectedWork}
            onBack={() => setSelectedId(null)}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="作品管理"
        description="点击作品卡片查看图片、文案 JSON 与提示词详情"
      />

      {works.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>暂无作品</CardTitle>
            <CardDescription>
              在 AI+ 中完成合成预览后点击「导入到作品」，或使用自动化模块生成作品。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/ai-plus">前往 AI+</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/image-edit">前往图像编辑</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">共 {works.length} 个作品</p>
          <StaggerContainer
            className={cn(
              "grid gap-5",
              "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
            )}
          >
            {works.map((work) => (
              <StaggerItem key={work.id}>
                <WorkCompactCard
                  work={work}
                  onClick={() => setSelectedId(work.id)}
                  onDelete={handleDelete}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      )}
    </div>
  );
}
