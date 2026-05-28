"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadWechatSettings,
  saveWechatSettings,
} from "@/lib/wechat-settings";
import { testWechatConnection } from "@/lib/wechat-client";
import type { WechatSettingsStore } from "@/types/wechat";

interface WechatSettingsCardProps {
  settings: WechatSettingsStore;
  onChange: (settings: WechatSettingsStore) => void;
}

export function WechatSettingsCard({
  settings,
  onChange,
}: WechatSettingsCardProps) {
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    saveWechatSettings(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, [settings]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestOk(false);
    setTestError(null);
    try {
      saveWechatSettings(settings);
      await testWechatConnection(settings);
      setTestOk(true);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "连接失败");
    } finally {
      setTesting(false);
    }
  }, [settings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>公众号配置</CardTitle>
        <CardDescription>
          填写微信公众平台开发配置中的 AppID 与 AppSecret。也可在服务端设置环境变量
          WECHAT_APP_ID / WECHAT_APP_SECRET。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wechat-app-id">AppID</Label>
            <Input
              id="wechat-app-id"
              value={settings.appId}
              onChange={(e) =>
                onChange({ ...settings, appId: e.target.value.trim() })
              }
              placeholder="wx..."
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wechat-app-secret">AppSecret</Label>
            <Input
              id="wechat-app-secret"
              type="password"
              value={settings.appSecret}
              onChange={(e) =>
                onChange({ ...settings, appSecret: e.target.value.trim() })
              }
              placeholder="应用密钥"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wechat-default-author">默认作者（可选）</Label>
          <Input
            id="wechat-default-author"
            value={settings.defaultAuthor ?? ""}
            onChange={(e) =>
              onChange({ ...settings, defaultAuthor: e.target.value })
            }
            placeholder="创建草稿时自动填入"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={handleSave}>
            {saved ? "已保存" : "保存配置"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testing || !settings.appId || !settings.appSecret}
            onClick={() => void handleTest()}
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                测试中…
              </>
            ) : (
              "测试 access_token"
            )}
          </Button>
          {testOk && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              连接正常
            </span>
          )}
        </div>
        {testError && (
          <p className="text-sm text-destructive">{testError}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function useWechatSettings() {
  const [settings, setSettings] = useState(loadWechatSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettings(loadWechatSettings());
    setMounted(true);
  }, []);

  return { settings, setSettings, mounted };
}
