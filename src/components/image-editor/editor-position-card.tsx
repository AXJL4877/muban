"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PositionCardState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMulti: boolean;
  count: number;
  elementId?: string;
  elementIds?: string[];
}

interface EditorPositionCardProps {
  state: PositionCardState | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onChangeX: (x: number) => void;
  onChangeY: (y: number) => void;
  onChangeElementId: (id: string) => { ok: boolean; error?: string };
}

const DEFAULT_OFFSET = { x: 12, y: 64 };

export function EditorPositionCard({
  state,
  containerRef,
  onChangeX,
  onChangeY,
  onChangeElementId,
}: EditorPositionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const [expanded, setExpanded] = useState(true);
  const [offset, setOffset] = useState(DEFAULT_OFFSET);
  const [copied, setCopied] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const container = containerRef.current;
      const card = cardRef.current;
      if (!container || !card) return { x, y };
      const maxX = Math.max(8, container.clientWidth - card.offsetWidth - 8);
      const maxY = Math.max(8, container.clientHeight - card.offsetHeight - 8);
      return {
        x: Math.min(Math.max(8, x), maxX),
        y: Math.min(Math.max(8, y), maxY),
      };
    },
    [containerRef]
  );

  const onDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button,input")) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const nx = dragRef.current.origX + e.clientX - dragRef.current.startX;
      const ny = dragRef.current.origY + e.clientY - dragRef.current.startY;
      setOffset(clampPosition(nx, ny));
    };
    const onUp = () => {
      dragRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [clampPosition]);

  useEffect(() => {
    setIdError(null);
  }, [state?.elementId]);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (!state) return null;

  const displayId = state.isMulti
    ? state.elementIds?.[0]
      ? `${state.elementIds[0].slice(0, 10)}… +${state.count - 1}`
      : `已选 ${state.count} 个`
    : state.elementId ?? "—";

  return (
    <div
      ref={cardRef}
      className={cn(
        "pointer-events-auto absolute z-40 w-[168px] select-none rounded-md border border-border/40",
        "bg-background/55 shadow-sm backdrop-blur-[2px]"
      )}
      style={{ left: offset.x, top: offset.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex cursor-grab items-center gap-0.5 border-b border-border/30 px-1 py-0.5 active:cursor-grabbing"
        onMouseDown={onDragStart}
      >
        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/70" />
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-muted-foreground">
          {displayId}
        </span>
        {!state.isMulti && state.elementId ? (
          <button
            type="button"
            title="复制键名"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background/80"
            onClick={() => void copyId(state.elementId!)}
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
        ) : null}
        <button
          type="button"
          title={expanded ? "收起" : "展开"}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background/80"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {expanded ? (
        <div className="space-y-1 px-1.5 py-1">
          {state.isMulti ? (
            <p className="text-[9px] leading-tight text-muted-foreground">
              多选 {state.count} 个，请单选后编辑键名与坐标
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[22px_1fr] items-center gap-x-1 gap-y-0.5">
                <span className="text-[9px] text-muted-foreground">键</span>
                <Input
                  key={`id-${state.elementId}`}
                  type="text"
                  className={cn(
                    "h-6 border-border/40 bg-background/40 px-1.5 font-mono text-[10px]",
                    idError && "border-destructive/60"
                  )}
                  defaultValue={state.elementId}
                  placeholder="元素键名"
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v.trim() === state.elementId) return;
                    const result = onChangeElementId(v);
                    if (!result.ok) {
                      setIdError(result.error ?? "无效键名");
                      e.target.value = state.elementId ?? "";
                    } else {
                      setIdError(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <span className="text-[9px] text-muted-foreground">X</span>
                <Input
                  key={`x-${state.x}-${state.y}`}
                  type="number"
                  className="h-6 border-border/40 bg-background/40 px-1.5 text-[10px] tabular-nums"
                  defaultValue={state.x}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v) && v !== state.x) onChangeX(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <span className="text-[9px] text-muted-foreground">Y</span>
                <Input
                  key={`y-${state.x}-${state.y}`}
                  type="number"
                  className="h-6 border-border/40 bg-background/40 px-1.5 text-[10px] tabular-nums"
                  defaultValue={state.y}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v) && v !== state.y) onChangeY(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
              {idError ? (
                <p className="text-[9px] text-destructive">{idError}</p>
              ) : null}
            </>
          )}
          <p className="text-[9px] tabular-nums text-muted-foreground/80">
            {state.width}×{state.height}
            {copied ? " · 已复制" : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
