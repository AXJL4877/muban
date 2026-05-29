"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Braces, Eye, ImageIcon, Workflow } from "lucide-react";
import { Skeleton, SkeletonGroup } from "@/components/motion/skeleton";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  loadAiPlusUiState,
  saveAiPlusUiState,
  type AiPlusTab,
} from "@/lib/ai-plus-ui-storage";
import { JsonGeneratorPanel } from "@/components/ai-plus/json-generator-panel";
import { ImageGeneratorPanel } from "@/components/ai-plus/image-generator-panel";
import { PreviewGeneratorPanel } from "@/components/ai-plus/preview-generator-panel";
import { AutomationGeneratorPanel } from "@/components/ai-plus/automation-generator-panel";

const tabs: { id: AiPlusTab; label: string; icon: typeof Braces }[] = [
  { id: "json", label: "文案 JSON", icon: Braces },
  { id: "image", label: "图片生成", icon: ImageIcon },
  { id: "preview", label: "合成预览", icon: Eye },
  { id: "automation", label: "自动化", icon: Workflow },
];

export function AiPlusTabs() {
  const [active, setActive] = useState<AiPlusTab | null>(null);

  useEffect(() => {
    setActive(loadAiPlusUiState().activeTab);
  }, []);

  const selectTab = (id: AiPlusTab) => {
    setActive(id);
    saveAiPlusUiState({ activeTab: id });
  };

  if (active === null) {
    return (
      <SkeletonGroup className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-[420px]" />
      </SkeletonGroup>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="inline-flex shrink-0 rounded-lg border bg-muted/30 p-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                active === id
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active === id && (
                <motion.span
                  layoutId="ai-plus-tab"
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={transitions.springSoft}
                />
              )}
              <Icon className="relative h-3.5 w-3.5" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={active === "json" ? undefined : "hidden"}>
          <JsonGeneratorPanel />
        </div>
        <div className={active === "image" ? undefined : "hidden"}>
          <ImageGeneratorPanel />
        </div>
        <div className={active === "preview" ? undefined : "hidden"}>
          <PreviewGeneratorPanel />
        </div>
        <div className={active === "automation" ? undefined : "hidden"}>
          <AutomationGeneratorPanel />
        </div>
      </div>
    </div>
  );
}
