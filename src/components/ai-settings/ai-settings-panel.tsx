"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AI_PROVIDERS,
  AI_SETTINGS_STORAGE_KEY,
  buildDefaultSettings,
  mergeWithDefaults,
} from "@/lib/ai-providers";
import type { AiProviderConfig, AiProviderId, AiSettingsStore } from "@/types/ai";
import { ProviderConfigCard } from "./provider-config-card";

export function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettingsStore>(buildDefaultSettings);
  const [savedProvider, setSavedProvider] = useState<AiProviderId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AiSettingsStore>;
        setSettings(mergeWithDefaults(parsed));
      }
    } catch {
      /* ignore invalid storage */
    }
    setMounted(true);
  }, []);

  const updateProvider = useCallback((providerId: AiProviderId, config: AiProviderConfig) => {
    setSettings((prev) => ({ ...prev, [providerId]: config }));
    setSavedProvider(null);
  }, []);

  const saveProvider = useCallback(
    (providerId: AiProviderId) => {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setSavedProvider(providerId);
      window.setTimeout(() => setSavedProvider(null), 2500);
    },
    [settings]
  );

  if (!mounted) {
    return (
      <div className="grid max-w-2xl gap-4">
        {AI_PROVIDERS.map((p) => (
          <div key={p.id} className="h-32 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid max-w-2xl gap-4">
      {AI_PROVIDERS.map((provider) => (
        <ProviderConfigCard
          key={provider.id}
          provider={provider}
          config={settings[provider.id]}
          onChange={(config) => updateProvider(provider.id, config)}
          onSave={() => saveProvider(provider.id)}
          saved={savedProvider === provider.id}
        />
      ))}
    </div>
  );
}
