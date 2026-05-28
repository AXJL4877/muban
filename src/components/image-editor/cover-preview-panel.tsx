"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { EDITOR_CHROME_ATTR } from "./use-canvas-outside-deselect";

const STORAGE_PREFIX = "cover-preview-pos:";
const PANEL_WIDTH = 288;

interface CoverPreviewPanelProps {
  coverPreview: string;
  coverTitle: string;
  templateId?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function loadStoredPosition(templateId?: string): { x: number; y: number } | null {
  if (typeof window === "undefined" || !templateId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${templateId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clampPosition(
  pos: { x: number; y: number },
  container: HTMLDivElement,
  panelHeight: number
): { x: number; y: number } {
  const maxX = Math.max(8, container.clientWidth - PANEL_WIDTH - 8);
  const maxY = Math.max(8, container.clientHeight - panelHeight - 8);
  return {
    x: Math.min(Math.max(8, pos.x), maxX),
    y: Math.min(Math.max(8, pos.y), maxY),
  };
}

export function CoverPreviewPanel({
  coverPreview,
  coverTitle,
  templateId,
  containerRef,
}: CoverPreviewPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stored = loadStoredPosition(templateId);
    const panelHeight = panelRef.current?.offsetHeight ?? 420;
    const defaultPos = {
      x: Math.max(8, container.clientWidth - PANEL_WIDTH - 16),
      y: 112,
    };
    setPosition(clampPosition(stored ?? defaultPos, container, panelHeight));
  }, [containerRef, templateId, coverPreview]);

  const persistPosition = useCallback(
    (pos: { x: number; y: number }) => {
      if (!templateId) return;
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${templateId}`, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    },
    [templateId]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!position) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: position.x,
        originY: position.y,
      };
    },
    [position]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;

      const panelHeight = panelRef.current?.offsetHeight ?? 420;
      const next = clampPosition(
        {
          x: drag.originX + (event.clientX - drag.startX),
          y: drag.originY + (event.clientY - drag.startY),
        },
        container,
        panelHeight
      );
      setPosition(next);
    },
    [containerRef]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (position) persistPosition(position);
    },
    [persistPosition, position]
  );

  if (!coverPreview || !position) return null;

  return (
    <aside
      ref={panelRef}
      {...{ [EDITOR_CHROME_ATTR]: "" }}
      className="absolute z-20 w-72 rounded-lg border bg-background/95 p-3 shadow-xl backdrop-blur"
      style={{ left: position.x, top: position.y }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="拖动封面预览"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="mb-2 flex cursor-grab items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-medium">
          封面大图预览{coverTitle ? ` · ${coverTitle}` : ""}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverPreview}
          alt="作品封面预览"
          className="max-h-[360px] w-full object-contain"
          draggable={false}
        />
      </div>
    </aside>
  );
}
