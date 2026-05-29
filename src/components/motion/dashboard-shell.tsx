"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { PageTransition } from "@/components/motion/page-transition";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <PageTransition key={pathname}>{children}</PageTransition>
      </main>
    </div>
  );
}
