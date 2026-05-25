"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Type, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FontOption } from "@/lib/custom-fonts";

const FONT_ACCEPT = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={rootRef} className="relative">
      <button
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

      {open && (
        <div
          className={cn(
            "absolute right-full top-0 z-50 mr-2 flex w-48 flex-col overflow-hidden",
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
        </div>
      )}
    </div>
  );
}
