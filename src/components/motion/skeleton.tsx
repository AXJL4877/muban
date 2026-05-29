"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      className={cn("rounded-lg border bg-muted/40", className)}
      animate={{ opacity: [0.45, 0.75, 0.45] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

interface SkeletonGroupProps {
  className?: string;
  children: React.ReactNode;
}

export function SkeletonGroup({ className, children }: SkeletonGroupProps) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={{
        animate: { transition: { staggerChildren: 0.1 } },
      }}
    >
      {children}
    </motion.div>
  );
}
