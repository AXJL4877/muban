"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  deleteTemplate,
  loadTemplates,
  renameTemplate,
} from "@/lib/image-templates";
import type { SavedImageTemplate, TemplateElementInfo } from "@/types/image-template";

function PropertyRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-foreground">{value}</span>
    </div>
  );
}

function ElementDetail({ element }: { element: TemplateElementInfo }) {
  const extraEntries = Object.entries(element.extra).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Layers className="h-3.5 w-3.5 text-primary" />
        {element.label}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
          {element.type}
        </span>
      </div>
      <div className="space-y-1.5">
        <PropertyRow label="位置 X" value={element.left} />
        <PropertyRow label="位置 Y" value={element.top} />
        <PropertyRow label="宽度" value={element.width} />
        <PropertyRow label="高度" value={element.height} />
        <PropertyRow label="缩放 X" value={element.scaleX} />
        <PropertyRow label="缩放 Y" value={element.scaleY} />
        <PropertyRow label="旋转角度" value={element.angle} />
        <PropertyRow label="透明度" value={element.opacity} />
        <PropertyRow label="填充色" value={element.fill} />
        <PropertyRow label="描边色" value={element.stroke} />
        <PropertyRow label="描边宽度" value={element.strokeWidth} />
        <PropertyRow label="文本内容" value={element.text} />
        <PropertyRow label="字体" value={element.fontFamily} />
        <PropertyRow label="字号" value={element.fontSize} />
        <PropertyRow label="字重" value={element.fontWeight} />
        <PropertyRow label="字形" value={element.fontStyle} />
        <PropertyRow label="对齐" value={element.textAlign} />
        <PropertyRow label="字间距" value={element.charSpacing} />
        <PropertyRow label="可选中" value={element.selectable != null ? String(element.selectable) : null} />
        <PropertyRow label="可见" value={element.visible != null ? String(element.visible) : null} />
        <PropertyRow label="含图片资源" value={element.hasImageSrc ? "是" : null} />
        {extraEntries.map(([key, value]) => (
          <PropertyRow
            key={key}
            label={key}
            value={
              typeof value === "object"
                ? JSON.stringify(value)
                : String(value)
            }
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onDelete,
  onRename,
}: {
  template: SavedImageTemplate;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(template.name);

  useEffect(() => {
    setEditingName(template.name);
  }, [template.name]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border bg-muted/40 sm:w-48">
            {template.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.thumbnail}
                alt={template.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-muted-foreground">
                无预览
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => {
                if (editingName.trim() && editingName !== template.name) {
                  onRename(template.id, editingName);
                }
              }}
              className="h-9 font-semibold"
            />
            <CardDescription>
              保存于 {formatDate(new Date(template.savedAt))} · 画布{" "}
              {template.canvasSize.width} × {template.canvasSize.height} ·{" "}
              {template.elementCount} 个元素
            </CardDescription>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/image-edit?templateId=${template.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  在编辑器中打开
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(template.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="font-medium">元素属性详情</span>
          <span className="text-muted-foreground">（{template.elementCount} 项）</span>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {template.elements.length === 0 ? (
              <p className="text-sm text-muted-foreground">该作品暂无画布元素</p>
            ) : (
              template.elements.map((el) => (
                <ElementDetail key={`${template.id}-${el.index}`} element={el} />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TemplatesPanel() {
  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      setTemplates(await loadTemplates());
    })();
  }, []);

  useEffect(() => {
    refresh();
    setMounted(true);
  }, [refresh]);

  const handleDelete = useCallback(
    (id: string) => {
      void (async () => {
      if (!confirm("确定删除该作品？此操作不可恢复。")) return;
      await deleteTemplate(id);
      refresh();
      })();
    },
    [refresh]
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      void (async () => {
        await renameTemplate(id, name);
        refresh();
      })();
    },
    [refresh]
  );

  if (!mounted) {
    return (
      <div className="p-8">
        <PageHeader title="我的模板" description="加载中…" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="我的模板"
        description="展示图像编辑中保存过的所有作品，包含每个元素的完整属性信息"
      />

      {templates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>暂无保存的作品</CardTitle>
            <CardDescription>
              在图像编辑中完成设计后，点击右上角保存按钮（或 Ctrl+S），作品将自动出现在此处。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/image-edit">前往图像编辑</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={cn("space-y-6")}>
          <p className="text-sm text-muted-foreground">
            共 {templates.length} 个作品，按保存时间倒序排列
          </p>
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
