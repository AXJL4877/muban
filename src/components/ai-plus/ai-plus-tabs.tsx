"use client";

import { useState } from "react";
import { Braces, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { JsonGeneratorPanel } from "@/components/ai-plus/json-generator-panel";
import { ImageGeneratorPanel } from "@/components/ai-plus/image-generator-panel";

type AiPlusTab = "json" | "image";

const tabs: { id: AiPlusTab; label: string; icon: typeof Braces }[] = [
  { id: "json", label: "文案 JSON", icon: Braces },
  { id: "image", label: "图片生成", icon: ImageIcon },
];

export function AiPlusTabs() {
  const [active, setActive] = useState<AiPlusTab>("image");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
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
