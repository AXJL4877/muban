"use client";

import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDITOR_CHROME_ATTR } from "./use-canvas-outside-deselect";

interface EditorActionBarProps {
  canUndo: boolean;
  canRedo: boolean;
  saveHint?: string;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

function ActionBtn({
  onClick,
  disabled,
  title,
  children,
  primary,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function EditorActionBar({
  canUndo,
  canRedo,
  saveHint,
  onUndo,
  onRedo,
  onSave,
}: EditorActionBarProps) {
  return (
    <div
      {...{ [EDITOR_CHROME_ATTR]: "" }}
      className="absolute right-4 top-4 z-30 flex flex-col items-end gap-1"
    >
      <div className="flex items-center gap-1 rounded-xl border bg-card/95 p-1.5 shadow-lg backdrop-blur-sm">
        <ActionBtn onClick={onUndo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
          <ArrowLeft className="h-4 w-4" />
        </ActionBtn>
        <ActionBtn onClick={onSave} title="保存 (Ctrl+S)" primary>
          <Save className="h-4 w-4" />
        </ActionBtn>
        <ActionBtn onClick={onRedo} disabled={!canRedo} title="重做 (Ctrl+Y)">
          <ArrowRight className="h-4 w-4" />
        </ActionBtn>
      </div>
      {saveHint && (
        <span className="rounded-md bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
          {saveHint}
        </span>
      )}
    </div>
  );
}
