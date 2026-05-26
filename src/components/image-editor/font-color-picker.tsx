"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseHexColorInput, toHexColorOrFallback } from "@/lib/color-utils";

interface FontColorPickerProps {
  value: string;
  disabled?: boolean;
  onChange: (color: string) => void;
}

export function FontColorPicker({
  value,
  disabled,
  onChange,
}: FontColorPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState("");
  const [hexError, setHexError] = useState<string | null>(null);

  const displayHex = toHexColorOrFallback(value);

  useEffect(() => {
    if (open) {
      setHexDraft(displayHex);
      setHexError(null);
    }
  }, [open, displayHex]);

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

  const applyHex = useCallback(
    (raw: string) => {
      const parsed = parseHexColorInput(raw);
      if (!parsed) {
        setHexError("请输入有效色值，如 #FF5500 或 FF5500");
        return false;
      }
      setHexError(null);
      setHexDraft(parsed);
      onChange(parsed);
      return true;
    },
    [onChange]
  );

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyHex(hexDraft);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="字体颜色"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
          "hover:bg-accent disabled:pointer-events-none disabled:opacity-40",
          open && "bg-accent ring-1 ring-ring"
        )}
      >
        <span
          className="h-4 w-4 rounded-sm border border-border/60"
          style={{ backgroundColor: displayHex }}
        />
      </button>

      {open && !disabled && (
        <div
          className={cn(
            "absolute right-full top-0 z-50 mr-2 w-44 overflow-hidden",
            "rounded-lg border bg-popover text-popover-foreground shadow-lg"
          )}
        >
          <div className="border-b px-2.5 py-1.5 text-[10px] text-muted-foreground">
            字体颜色
          </div>

          <div className="space-y-2 p-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 hover:bg-accent/50">
              <input
                type="color"
                value={displayHex}
                onChange={(e) => {
                  const next = e.target.value;
                  setHexDraft(next);
                  setHexError(null);
                  onChange(next);
                }}
                className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="调色板选色"
              />
              <span className="text-xs text-muted-foreground">调色板</span>
            </label>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={hexDraft}
                  onChange={(e) => {
                    setHexDraft(e.target.value);
                    setHexError(null);
                  }}
                  onBlur={() => applyHex(hexDraft)}
                  onKeyDown={handleHexKeyDown}
                  placeholder="#FF5500"
                  spellCheck={false}
                  className={cn(
                    "h-8 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-xs",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    hexError && "border-destructive"
                  )}
                  aria-label="十六进制色值"
                />
              </div>
              {hexError ? (
                <p className="text-[10px] text-destructive">{hexError}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  支持 #RGB、#RRGGBB，回车或失焦应用
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
