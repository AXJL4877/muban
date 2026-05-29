"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { AutomationGlobalBanner } from "@/components/shared/automation-global-banner";
import { AutomationRunnerProvider } from "@/components/ai-plus/automation-runner-provider";
import { PageTransition } from "@/components/motion/page-transition";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AutomationRunnerProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AutomationGlobalBanner />
          <main className="flex-1 overflow-auto bg-background">
            <PageTransition key={pathname}>{children}</PageTransition>
          </main>
        </div>
      </div>
    </AutomationRunnerProvider>
  );
}
