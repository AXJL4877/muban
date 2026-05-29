"use client";

import { motion } from "framer-motion";
import { fadeInUp, transitions } from "@/lib/motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={transitions.normal}
    >
      {children}
    </motion.div>
  );
}
