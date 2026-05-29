"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
}

export function LoadingSpinner({ className, label }: LoadingSpinnerProps) {
  return (
    <span className="inline-flex items-center">
      <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin", className)} />
      {label ? <span className="ml-2">{label}</span> : null}
    </span>
  );
}
