"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { fadeInUp, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

export function FadeIn({ className, delay = 0, children, ...props }: FadeInProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={{ ...transitions.normal, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
