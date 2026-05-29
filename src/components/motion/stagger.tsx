"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface StaggerContainerProps extends HTMLMotionProps<"div"> {}

export function StaggerContainer({ className, children, ...props }: StaggerContainerProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps extends HTMLMotionProps<"div"> {}

export function StaggerItem({ className, children, ...props }: StaggerItemProps) {
  return (
    <motion.div className={cn(className)} variants={staggerItem} {...props}>
      {children}
    </motion.div>
  );
}
