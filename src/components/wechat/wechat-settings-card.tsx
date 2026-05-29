"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/motion/loading-spinner";
import { Skeleton } from "@/components/motion/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildDefaultWechatSettings,
  loadWechatSettings,
  saveWechatSettings,
} from "@/lib/wechat-settings";
import { isValidWechatAppId } from "@/lib/wechat-credentials";
import { hydrateWechatSettingsFromServer, persistWechatSettingsToServer } from "@/lib/wechat-draft-prefs-client";
import { testWechatConnection } from "@/lib/wechat-client";
import type { WechatSettingsStore } from "@/types/wechat";
import type { WechatBodyContentPattern } from "@/types/wechat";

interface WechatSettingsCardProps {
  settings: WechatSettingsStore;
  onChange: (settings: WechatSettingsStore) => void;
  /** 客户端配置加载完成后再渲染表单，避免 SSR 水合不一致 */
  ready?: boolean;
}

export function WechatSettingsCard({
  settings,
  onChange,
  ready = true,
}: WechatSettingsCardProps) {
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const appIdInvalid =
    ready && settings.appId.trim().length > 0 && !isValidWechatAppId(settings.appId);

  const handleSave = useCallback(() => {
    void (async () => {
      try {
        await persistWechatSettingsToServer(settings);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        setTestError(err instanceof Error ? err.message : "保存失败");
      }
    })();
  }, [settings]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestOk(false);
    setTestError(null);
    try {
      await saveWechatSettings(settings);
      await testWechatConnection(settings);
      setTestOk(true);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "连接失败");
    } finally {
      setTesting(false);
    }
  }, [settings]);

  if (!ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>公众号配置</CardTitle>
          <CardDescription>正在加载已保存的配置…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>公众号配置</CardTitle>
        <CardDescription>
          填写微信公众平台开发配置中的 AppID 与 AppSecret。配置会同步保存到服务端
          data/wechat-prefs.json。也可使用环境变量 WECHAT_APP_ID / WECHAT_APP_SECRET。
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
            {appIdInvalid && (
              <p className="text-xs text-destructive">
                AppID 应以 wx 开头（18 位），请填写微信公众平台开发配置中的值，而非昵称。
              </p>
            )}
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
          <Label htmlFor="wechat-default-author">固定作者</Label>
          <Input
            id="wechat-default-author"
            value={settings.defaultAuthor ?? ""}
            onChange={(e) =>
              onChange({ ...settings, defaultAuthor: e.target.value })
            }
            placeholder="创建草稿时默认填入，可在创建页锁定"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wechat-default-title-key">默认标题字段</Label>
            <Input
              id="wechat-default-title-key"
              value={settings.defaultTitleFieldKey ?? ""}
              onChange={(e) =>
                onChange({ ...settings, defaultTitleFieldKey: e.target.value })
              }
              placeholder="如：大标题（对应作品 JSON elementId）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wechat-default-digest-key">默认摘要字段</Label>
            <Input
              id="wechat-default-digest-key"
              value={settings.defaultDigestFieldKey ?? ""}
              onChange={(e) =>
                onChange({ ...settings, defaultDigestFieldKey: e.target.value })
              }
              placeholder="可选，如：回答"
            />
          </div>
        </div>
        <div className="space-y-3 border-t pt-3">
          <div>
            <p className="text-sm font-medium">新作品默认发布模板</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              未单独配置过的作品将自动应用此模板；在任一作品上调整勾选后也会同步更新。
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wechat-default-publish-cover">默认封面</Label>
            <select
              id="wechat-default-publish-cover"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={settings.defaultPublishCoverId ?? "cover-thumbnail"}
              onChange={(e) =>
                onChange({ ...settings, defaultPublishCoverId: e.target.value })
              }
            >
              <option value="cover-thumbnail">封面图</option>
              <option value="composed-canvas">合成整图</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm">默认正文勾选</p>
            {(
              [
                { id: "composed", label: "合成整图" },
                { id: "text", label: "全部文字" },
                { id: "image", label: "全部配图" },
                { id: "cover", label: "封面图（作为正文图）" },
              ] as const
            ).map((item) => {
              const pattern = settings.defaultPublishBodyPattern ?? ["composed"];
              const checked = pattern.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(pattern);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      const ordered: WechatBodyContentPattern[] = [
                        "composed",
                        "cover",
                        "text",
                        "image",
                      ];
                      onChange({
                        ...settings,
                        defaultPublishBodyPattern: ordered.filter((k) =>
                          next.has(k)
                        ),
                      });
                    }}
                  />
                  {item.label}
                </label>
              );
            })}
          </div>
        </div>
        <div className="space-y-2 border-t pt-2">
          <p className="text-sm font-medium">默认评论设置</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border"
              checked={settings.needOpenComment ?? false}
              onChange={(e) =>
                onChange({ ...settings, needOpenComment: e.target.checked })
              }
            />
            新建草稿时默认打开评论
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${
              settings.needOpenComment
                ? "cursor-pointer"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border"
              checked={settings.onlyFansCanComment ?? false}
              disabled={!settings.needOpenComment}
              onChange={(e) =>
                onChange({
                  ...settings,
                  onlyFansCanComment: e.target.checked,
                })
              }
            />
            默认仅粉丝可评论
          </label>
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
                <LoadingSpinner className="mr-2 h-4 w-4" />
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
  const [settings, setSettings] = useState(buildDefaultWechatSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const merged = await hydrateWechatSettingsFromServer();
        setSettings(merged);
      } catch {
        setSettings(await loadWechatSettings());
      } finally {
        setMounted(true);
      }
    })();
  }, []);

  return { settings, setSettings, mounted };
}
