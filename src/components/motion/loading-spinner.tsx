"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
}

export function LoadingSpinner({ className, label }: LoadingSpinnerProps) {
  return (
    <span className="inline-flex items-center">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        className="inline-flex"
      >
        <Loader2 className={cn("h-4 w-4", className)} />
      </motion.span>
      {label ? <span className="ml-2">{label}</span> : null}
    </span>
  );
}
