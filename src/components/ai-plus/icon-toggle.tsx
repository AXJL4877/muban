"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconToggleProps {
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}

export function IconToggle({
  icon: Icon,
  active,
  onClick,
  title,
  disabled,
}: IconToggleProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        "hover:bg-accent disabled:pointer-events-none disabled:opacity-30",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground/35"
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.25 : 1.75} />
    </button>
  );
}
