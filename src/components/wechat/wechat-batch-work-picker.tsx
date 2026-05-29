"use client";

import { useMemo } from "react";
import { ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { extractWorkImages } from "@/lib/work-assets";
import type { SavedImageTemplate } from "@/types/image-template";

function getWorkCoverSrc(work: SavedImageTemplate): string | null {
  if (work.thumbnail) return work.thumbnail;
  const images = extractWorkImages(work);
  return images[0]?.src ?? null;
}

export interface WorkBatchItemStatus {
  valid: boolean;
  reason?: string;
}

interface WechatBatchWorkPickerProps {
  works: SavedImageTemplate[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  getWorkStatus: (work: SavedImageTemplate) => WorkBatchItemStatus;
  disabled?: boolean;
}

export function WechatBatchWorkPicker({
  works,
  selectedIds,
  onSelectionChange,
  getWorkStatus,
  disabled,
}: WechatBatchWorkPickerProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const uploadableIds = useMemo(
    () => works.filter((work) => getWorkStatus(work).valid).map((work) => work.id),
    [works, getWorkStatus]
  );

  const toggleWork = (workId: string) => {
    if (selectedSet.has(workId)) {
      onSelectionChange(selectedIds.filter((id) => id !== workId));
    } else {
      onSelectionChange([...selectedIds, workId]);
    }
  };

  if (works.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        暂无作品，请先在{" "}
        <span className="text-foreground">作品管理</span> 中保存。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>选择要上传的作品（套用全局发布模板）</Label>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="text-primary hover:underline disabled:opacity-50"
            disabled={disabled || uploadableIds.length === 0}
            onClick={() => onSelectionChange(uploadableIds)}
          >
            全选可上传
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => onSelectionChange([])}
          >
            清空
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {works.map((work) => {
          const status = getWorkStatus(work);
          const checked = selectedSet.has(work.id);
          const coverSrc = getWorkCoverSrc(work);

          return (
            <label
              key={work.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                checked ? "border-primary bg-primary/5" : "hover:bg-muted/30",
                (!status.valid || disabled) && "opacity-60",
                disabled && "pointer-events-none"
              )}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border"
                checked={checked}
                disabled={disabled || !status.valid}
                onChange={() => toggleWork(work.id)}
              />
              {coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverSrc}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded border object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-muted/40">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{work.name}</p>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    status.valid ? "text-muted-foreground" : "text-destructive"
                  )}
                >
                  {status.valid ? "可上传" : status.reason ?? "不可上传"}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          已选 {selectedIds.length} 个作品，将依次上传并创建草稿。
        </p>
      )}
    </div>
  );
}
