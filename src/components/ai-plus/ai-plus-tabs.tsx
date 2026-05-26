"use client";

import { useEffect, useState } from "react";
import { Braces, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadAiPlusUiState,
  saveAiPlusUiState,
  type AiPlusTab,
} from "@/lib/ai-plus-ui-storage";
import { JsonGeneratorPanel } from "@/components/ai-plus/json-generator-panel";
import { ImageGeneratorPanel } from "@/components/ai-plus/image-generator-panel";

const tabs: { id: AiPlusTab; label: string; icon: typeof Braces }[] = [
  { id: "json", label: "文案 JSON", icon: Braces },
  { id: "image", label: "图片生成", icon: ImageIcon },
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
      <div className="space-y-4">
        <div className="h-9 w-52 animate-pulse rounded-lg border bg-muted/40" />
        <div className="h-[420px] animate-pulse rounded-lg border bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              active === id
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {active === "json" ? <JsonGeneratorPanel /> : <ImageGeneratorPanel />}
    </div>
  );
}
