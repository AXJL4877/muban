"use client";

import { useMemo } from "react";
import { ImageIcon, Layers, Type } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { WechatContentOption } from "@/lib/wechat-work-content";
import {
  getCoverImageOptions,
  getSelectableBodyOptions,
} from "@/lib/wechat-work-content";

interface WechatContentPickerProps {
  options: WechatContentOption[];
  coverId: string;
  bodyIds: string[];
  onCoverChange: (id: string) => void;
  onBodyChange: (ids: string[]) => void;
  disabled?: boolean;
}

function KindIcon({ kind }: { kind: WechatContentOption["kind"] }) {
  if (kind === "text") return <Type className="h-4 w-4 shrink-0" />;
  if (kind === "composed") return <Layers className="h-4 w-4 shrink-0" />;
  return <ImageIcon className="h-4 w-4 shrink-0" />;
}

function OptionPreview({ option }: { option: WechatContentOption }) {
  if (option.previewSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={option.previewSrc}
        alt=""
        className="h-12 w-12 shrink-0 rounded border object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-muted/40">
      <KindIcon kind={option.kind} />
    </div>
  );
}

export function WechatContentPicker({
  options,
  coverId,
  bodyIds,
  onCoverChange,
  onBodyChange,
  disabled,
}: WechatContentPickerProps) {
  const coverOptions = useMemo(() => getCoverImageOptions(options), [options]);
  const bodyOptions = useMemo(() => getSelectableBodyOptions(options), [options]);

  const toggleBody = (id: string) => {
    if (bodyIds.includes(id)) {
      onBodyChange(bodyIds.filter((item) => item !== id));
    } else {
      onBodyChange([...bodyIds, id]);
    }
  };

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        该作品暂无可选内容，请先在图像编辑中保存文字或图片。
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>草稿封面（永久素材 thumb_media_id）</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {coverOptions.map((option) => (
            <label
              key={`cover-${option.id}`}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                coverId === option.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/30",
                disabled && "pointer-events-none opacity-60"
              )}
            >
              <input
                type="radio"
                name="wechat-cover"
                className="sr-only"
                checked={coverId === option.id}
                disabled={disabled}
                onChange={() => onCoverChange(option.id)}
              />
              <OptionPreview option={option} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{option.label}</p>
                {option.previewText && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {option.previewText}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>正文内容（按勾选顺序组装）</Label>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="text-primary hover:underline disabled:opacity-50"
              disabled={disabled}
              onClick={() => onBodyChange(bodyOptions.map((o) => o.id))}
            >
              全选
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:underline disabled:opacity-50"
              disabled={disabled}
              onClick={() => onBodyChange([])}
            >
              清空
            </button>
          </div>
        </div>
        <div className="grid gap-2">
          {bodyOptions.map((option) => {
            const checked = bodyIds.includes(option.id);
            return (
              <label
                key={`body-${option.id}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  checked ? "border-primary/60 bg-primary/5" : "hover:bg-muted/30",
                  disabled && "pointer-events-none opacity-60"
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleBody(option.id)}
                />
                <OptionPreview option={option} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{option.label}</p>
                  {option.previewText && (
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {option.previewText}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
        {bodyIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            已选 {bodyIds.length} 项，顺序：{" "}
            {bodyIds
              .map((id) => bodyOptions.find((o) => o.id === id)?.label ?? id)
              .join(" → ")}
          </p>
        )}
      </div>
    </div>
  );
}
