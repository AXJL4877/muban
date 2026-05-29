"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Type, Upload } from "lucide-react";
import { LoadingSpinner } from "@/components/motion/loading-spinner";
import { cn } from "@/lib/utils";
import type { FontOption } from "@/lib/custom-fonts";

const FONT_ACCEPT = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";
const PANEL_WIDTH = 192;
const PANEL_GAP = 8;

interface FontPickerProps {
  value: string;
  options: FontOption[];
  /** 无文本选中时禁止切换字体，但仍可打开面板导入 */
  pickDisabled?: boolean;
  importing?: boolean;
  onChange: (family: string) => void;
  onImport: (file: File) => void | Promise<void>;
}

export function FontPicker({
  value,
  options,
  pickDisabled,
  importing,
  onChange,
  onImport,
}: FontPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(
    null
  );

  const updatePanelPos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left - PANEL_WIDTH - PANEL_GAP;
    let top = rect.top;

    const margin = 8;
    const maxTop = window.innerHeight - margin;
    const minTop = margin;
    top = Math.max(minTop, Math.min(top, maxTop - 280));

    if (left < margin) {
      left = rect.right + PANEL_GAP;
    }

    setPanelPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
    window.addEventListener("resize", updatePanelPos);
    window.addEventListener("scroll", updatePanelPos, true);
    return () => {
      window.removeEventListener("resize", updatePanelPos);
      window.removeEventListener("scroll", updatePanelPos, true);
    };
  }, [open, updatePanelPos]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      const panel = document.getElementById("font-picker-panel");
      if (panel?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handlePick = useCallback(
    (family: string) => {
      onChange(family);
      setOpen(false);
    },
    [onChange]
  );

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await onImport(file);
      setOpen(false);
    },
    [onImport]
  );

  const panel =
    open &&
    panelPos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        id="font-picker-panel"
        style={{
          position: "fixed",
          top: panelPos.top,
          left: panelPos.left,
          width: PANEL_WIDTH,
          zIndex: 9999,
        }}
        className={cn(
          "flex flex-col overflow-hidden",
          "rounded-lg border bg-popover text-popover-foreground shadow-lg"
        )}
      >
        <div className="border-b px-2.5 py-1.5 text-[10px] text-muted-foreground">
          字体
        </div>
        <div className="max-h-52 overflow-y-auto py-1">
          {options.map((font) => (
            <button
              key={`${font.source}-${font.family}`}
              type="button"
              disabled={pickDisabled}
              onClick={() => handlePick(font.family)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                pickDisabled && "cursor-not-allowed opacity-50",
                value === font.family && "bg-accent/80 font-medium"
              )}
              style={{ fontFamily: font.family }}
            >
              <span className="truncate">{font.family}</span>
              {font.source === "custom" && (
                <span className="shrink-0 text-[9px] text-muted-foreground">
                  本地
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="border-t bg-muted/30 p-1">
          <button
            type="button"
            disabled={importing}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              importing && "pointer-events-none opacity-60"
            )}
          >
            {importing ? (
              <LoadingSpinner className="h-3.5 w-3.5" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            导入字体…
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={FONT_ACCEPT}
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />
      </div>,
      document.body
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        title="字体"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-9 flex-col items-center justify-center gap-0.5 rounded-md transition-colors",
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground"
        )}
      >
        <Type className="h-3.5 w-3.5 shrink-0" />
        <span
          className="max-w-[2.5rem] truncate text-[8px] leading-none"
          style={{ fontFamily: value }}
        >
          字
        </span>
      </button>
      {panel}
    </div>
  );
}
