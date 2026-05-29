"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AI_PROVIDERS,
  buildDefaultSettings,
  loadAiSettingsFromStorage,
  loadExpandedState,
  saveAiSettingsToStorage,
  saveExpandedState,
} from "@/lib/ai-providers";
import type { AiProviderConfig, AiProviderId, AiSettingsStore } from "@/types/ai";
import type { AiSettingsExpandedState } from "@/lib/ai-providers";
import { ProviderConfigCard } from "./provider-config-card";
import { Skeleton, SkeletonGroup } from "@/components/motion/skeleton";

export function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettingsStore>(buildDefaultSettings);
  const [expandedMap, setExpandedMap] = useState<AiSettingsExpandedState>({});
  const [savedProvider, setSavedProvider] = useState<AiProviderId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    void (async () => {
      const loaded = await loadAiSettingsFromStorage();
      setSettings(loaded);
      setExpandedMap(loadExpandedState());
      setMounted(true);
    })();
  }, []);

  const setProviderExpanded = useCallback(
    (providerId: AiProviderId, expanded: boolean) => {
      setExpandedMap((prev) => {
        const next = { ...prev, [providerId]: expanded };
        saveExpandedState(next);
        return next;
      });
    },
    []
  );

  const updateProvider = useCallback((providerId: AiProviderId, config: AiProviderConfig) => {
    setSettings((prev) => ({ ...prev, [providerId]: config }));
    setSavedProvider(null);
  }, []);

  const saveProvider = useCallback(
    (providerId: AiProviderId) => {
      void (async () => {
        await saveAiSettingsToStorage(settings);
        setSavedProvider(providerId);
        window.setTimeout(() => setSavedProvider(null), 2500);
      })();
    },
    [settings]
  );

  if (!mounted) {
    return (
      <SkeletonGroup className="grid max-w-2xl gap-4">
        {AI_PROVIDERS.map((p) => (
          <Skeleton key={p.id} className="h-32" />
        ))}
      </SkeletonGroup>
    );
  }

  return (
    <div className="grid max-w-2xl gap-4">
      {AI_PROVIDERS.map((provider) => (
        <ProviderConfigCard
          key={provider.id}
          provider={provider}
          config={settings[provider.id]}
          expanded={expandedMap[provider.id] ?? false}
          onExpandedChange={(expanded) => setProviderExpanded(provider.id, expanded)}
          onChange={(config) => updateProvider(provider.id, config)}
          onSave={() => saveProvider(provider.id)}
          saved={savedProvider === provider.id}
        />
      ))}
    </div>
  );
}
