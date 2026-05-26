"use client";

import {
  ChevronDown,
  ChevronUp,
  Download,
  Eraser,
  ImageMinus,
  ImageUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorTopToolbarProps {
  expanded: boolean;
  onToggle: () => void;
  onImportBackground: () => void;
  onRemoveBackground: () => void;
  hasBackground: boolean;
  onExport: () => void;
  onClearCanvas: () => void;
  canvasSize: { width: number; height: number } | null;
}

export function EditorTopToolbar({
  expanded,
  onToggle,
  onImportBackground,
  onRemoveBackground,
  hasBackground,
  onExport,
  onClearCanvas,
  canvasSize,
}: EditorTopToolbarProps) {
  return (
    <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        title={expanded ? "收起工具栏" : "展开工具栏"}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full border bg-card/95 px-3 text-xs font-medium shadow-md backdrop-blur-sm",
          "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        )}
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        文件
      </button>

      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card/95 shadow-lg backdrop-blur-sm transition-all duration-200",
          expanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0 border-transparent"
        )}
      >
        <div className="flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={onImportBackground}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <ImageUp className="h-4 w-4 text-muted-foreground" />
            导入底图
          </button>
          <button
            type="button"
            onClick={onRemoveBackground}
            disabled={!hasBackground}
            title={hasBackground ? "删除底图" : "当前无底图"}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
              !hasBackground && "cursor-not-allowed opacity-40"
            )}
          >
            <ImageMinus className="h-4 w-4 text-muted-foreground" />
            删除底图
          </button>
          <div className="h-6 w-px bg-border" />
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            导出图片
          </button>
          <div className="h-6 w-px bg-border" />
          <button
            type="button"
            onClick={onClearCanvas}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <Eraser className="h-4 w-4" />
            清空画布
          </button>
          {canvasSize && (
            <>
              <div className="h-6 w-px bg-border" />
              <span className="px-2 text-xs tabular-nums text-muted-foreground">
                {canvasSize.width} × {canvasSize.height}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
