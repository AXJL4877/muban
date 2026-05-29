"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/motion/loading-spinner";
import { Skeleton } from "@/components/motion/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WechatBatchWorkPicker } from "@/components/wechat/wechat-batch-work-picker";
import { WechatContentPicker } from "@/components/wechat/wechat-content-picker";
import { WechatDraftMetaForm } from "@/components/wechat/wechat-draft-meta-form";
import {
  useWechatSettings,
  WechatSettingsCard,
} from "@/components/wechat/wechat-settings-card";
import { loadWorksLibrary } from "@/lib/image-templates";
import {
  resolveWechatContentBlocks,
  resolveWechatCoverImageSrc,
} from "@/lib/wechat-resolve-content";
import {
  listWorkTextFields,
  resolveWorkTextByKey,
  WECHAT_TEXT_SOURCE_MANUAL,
} from "@/lib/wechat-work-text-fields";
import { formatDate } from "@/lib/utils";
import { validateWechatCredentials } from "@/lib/wechat-credentials";
import {
  createWechatDraftFromWork,
  deleteWechatDraft,
  fetchWechatDraftList,
  uploadWechatMaterial,
} from "@/lib/wechat-client";
import { buildDefaultDraftFormState } from "@/lib/wechat-draft-prefs-apply";
import {
  buildDraftPayloadFromForm,
  validateWorkDraftDefaults,
} from "@/lib/wechat-draft-payload";
import {
  loadWechatPrefsStore,
  persistLastSelectedWorkId,
} from "@/lib/wechat-draft-prefs-client";
import { extractWechatContentOptions } from "@/lib/wechat-work-content";
import type { SavedImageTemplate } from "@/types/image-template";
import type { WechatDraftListItem } from "@/types/wechat";

function getDraftTitle(item: WechatDraftListItem): string {
  const first = item.content?.news_item?.[0];
  return first?.title?.trim() || "未命名草稿";
}

function getDraftThumb(item: WechatDraftListItem): string | null {
  const first = item.content?.news_item?.[0];
  return first?.thumb_url ?? null;
}

type UploadMode = "single" | "batch";

interface BatchUploadResult {
  workId: string;
  workName: string;
  ok: boolean;
  message: string;
}

export function WechatPanel() {
  const { settings, setSettings, mounted } = useWechatSettings();
  const [works, setWorks] = useState<SavedImageTemplate[]>([]);
  const [drafts, setDrafts] = useState<WechatDraftListItem[]>([]);
  const [draftTotal, setDraftTotal] = useState(0);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [title, setTitle] = useState("");
  const [titleSourceKey, setTitleSourceKey] = useState(WECHAT_TEXT_SOURCE_MANUAL);
  const [author, setAuthor] = useState("");
  const [useFixedAuthor, setUseFixedAuthor] = useState(false);
  const [digest, setDigest] = useState("");
  const [digestSourceKey, setDigestSourceKey] = useState(WECHAT_TEXT_SOURCE_MANUAL);
  const [contentSourceUrl, setContentSourceUrl] = useState("");
  const [needOpenComment, setNeedOpenComment] = useState(false);
  const [onlyFansCanComment, setOnlyFansCanComment] = useState(false);
  const [useCustomHtml, setUseCustomHtml] = useState(false);
  const [customContent, setCustomContent] = useState("");
  const [coverId, setCoverId] = useState("");
  const [bodyIds, setBodyIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");
  const [batchSelectedWorkIds, setBatchSelectedWorkIds] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    workName: string;
  } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchUploadResult[] | null>(
    null
  );

  const appliedWorkIdRef = useRef("");
  const pendingLastWorkIdRef = useRef<string | null>(null);

  const selectedWork = useMemo(
    () => works.find((w) => w.id === selectedWorkId) ?? null,
    [works, selectedWorkId]
  );

  const contentOptions = useMemo(
    () => (selectedWork ? extractWechatContentOptions(selectedWork) : []),
    [selectedWork]
  );

  const workTextFields = useMemo(
    () => (selectedWork ? listWorkTextFields(selectedWork) : []),
    [selectedWork]
  );

  const handleTitleSourceKeyChange = useCallback(
    (key: string) => {
      setTitleSourceKey(key);
      if (key === WECHAT_TEXT_SOURCE_MANUAL || !selectedWork) return;
      const text = resolveWorkTextByKey(selectedWork, key);
      if (text) setTitle(text);
    },
    [selectedWork]
  );

  const handleDigestSourceKeyChange = useCallback(
    (key: string) => {
      setDigestSourceKey(key);
      if (key === WECHAT_TEXT_SOURCE_MANUAL || !selectedWork) return;
      const text = resolveWorkTextByKey(selectedWork, key);
      if (text) setDigest(text);
    },
    [selectedWork]
  );

  const handleUseFixedAuthorChange = useCallback(
    (fixed: boolean) => {
      setUseFixedAuthor(fixed);
      if (fixed && settings.defaultAuthor) {
        setAuthor(settings.defaultAuthor);
      }
    },
    [settings.defaultAuthor]
  );

  const appId = settings.appId.trim();
  const appSecret = settings.appSecret.trim();

  const loadDrafts = useCallback(async () => {
    const credentialError = validateWechatCredentials(appId, appSecret);
    if (credentialError) {
      setListError(credentialError);
      setDrafts([]);
      setDraftTotal(0);
      return;
    }
    setLoadingDrafts(true);
    setListError(null);
    try {
      const data = await fetchWechatDraftList({ appId, appSecret }, 0, 20);
      setDrafts(data.items);
      setDraftTotal(data.total);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "加载草稿失败");
    } finally {
      setLoadingDrafts(false);
    }
  }, [appId, appSecret]);

  const refreshWorks = useCallback(() => {
    void (async () => {
      const list = await loadWorksLibrary();
      setWorks(list);
    })();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    refreshWorks();
    window.addEventListener("focus", refreshWorks);
    return () => window.removeEventListener("focus", refreshWorks);
  }, [mounted, refreshWorks]);

  useEffect(() => {
    if (!mounted) return;
    void (async () => {
      try {
        const store = await loadWechatPrefsStore();
        pendingLastWorkIdRef.current = store.lastSelectedWorkId ?? null;
      } catch {
        /* 使用本地默认 */
      } finally {
        setPrefsHydrated(true);
      }
    })();
  }, [mounted]);

  useEffect(() => {
    if (!prefsHydrated || works.length === 0) return;
    const pending = pendingLastWorkIdRef.current;
    if (!pending) return;
    pendingLastWorkIdRef.current = null;
    if (works.some((work) => work.id === pending)) {
      setSelectedWorkId(pending);
    }
  }, [prefsHydrated, works]);

  useEffect(() => {
    if (!mounted || !prefsHydrated) return;
    if (validateWechatCredentials(appId, appSecret)) return;
    void loadDrafts();
  }, [mounted, prefsHydrated, appId, appSecret, loadDrafts]);

  const applyDraftFormState = useCallback(
    (form: ReturnType<typeof buildDefaultDraftFormState>) => {
      setCoverId(form.coverId);
      setBodyIds(form.bodyIds);
      setTitleSourceKey(form.titleSourceKey);
      setTitle(form.title);
      setDigestSourceKey(form.digestSourceKey);
      setDigest(form.digest);
      setUseFixedAuthor(form.useFixedAuthor);
      setAuthor(form.author);
      setContentSourceUrl(form.contentSourceUrl);
      setNeedOpenComment(form.needOpenComment);
      setOnlyFansCanComment(form.onlyFansCanComment);
      setUseCustomHtml(form.useCustomHtml);
      setCustomContent(form.customContent);
    },
    []
  );

  useEffect(() => {
    if (!prefsHydrated) return;
    if (!selectedWork) {
      appliedWorkIdRef.current = "";
      setCoverId("");
      setBodyIds([]);
      return;
    }
    if (appliedWorkIdRef.current === selectedWork.id) return;

    appliedWorkIdRef.current = selectedWork.id;
    applyDraftFormState(buildDefaultDraftFormState(selectedWork, settings));
  }, [
    selectedWork,
    selectedWorkId,
    prefsHydrated,
    settings,
    applyDraftFormState,
  ]);

  useEffect(() => {
    if (!prefsHydrated || !selectedWorkId) return;
    void persistLastSelectedWorkId(selectedWorkId).catch(() => {
      /* 非关键偏好，忽略失败 */
    });
  }, [prefsHydrated, selectedWorkId]);

  const getWorkBatchStatus = useCallback(
    (work: SavedImageTemplate) => {
      const validation = validateWorkDraftDefaults(work, settings);
      return { valid: validation.ok, reason: validation.reason };
    },
    [settings]
  );

  const handleCreateFromWork = useCallback(async () => {
    if (!selectedWork) {
      setCreateError("请选择作品");
      return;
    }
    if (!title.trim()) {
      setCreateError("请填写标题");
      return;
    }

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const form = {
        coverId,
        bodyIds,
        titleSourceKey,
        title,
        digestSourceKey,
        digest,
        useFixedAuthor,
        author,
        contentSourceUrl,
        needOpenComment,
        onlyFansCanComment,
        useCustomHtml,
        customContent,
      };

      const payload = await buildDraftPayloadFromForm(
        selectedWork,
        form,
        settings
      );
      if (!payload) {
        setCreateError("无法构建草稿内容，请检查封面与正文选择");
        return;
      }

      const result = await createWechatDraftFromWork(settings, payload);
      setCreateSuccess(
        `草稿已创建（media_id: ${result.mediaId.slice(0, 12)}…）`
      );
      await loadDrafts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "创建草稿失败");
    } finally {
      setCreating(false);
    }
  }, [
    selectedWork,
    title,
    author,
    useFixedAuthor,
    digest,
    contentSourceUrl,
    needOpenComment,
    onlyFansCanComment,
    coverId,
    bodyIds,
    contentOptions,
    useCustomHtml,
    customContent,
    settings,
    loadDrafts,
  ]);

  const handleBatchCreate = useCallback(async () => {
    if (batchSelectedWorkIds.length === 0) {
      setCreateError("请至少选择一个作品");
      return;
    }

    const selectedWorks = batchSelectedWorkIds
      .map((id) => works.find((work) => work.id === id))
      .filter((work): work is SavedImageTemplate => !!work);

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    setBatchResults(null);
    setBatchProgress({
      current: 0,
      total: selectedWorks.length,
      workName: selectedWorks[0]?.name ?? "",
    });

    const results: BatchUploadResult[] = [];

    try {
      for (let index = 0; index < selectedWorks.length; index += 1) {
        const work = selectedWorks[index];
        setBatchProgress({
          current: index + 1,
          total: selectedWorks.length,
          workName: work.name,
        });

        const validation = validateWorkDraftDefaults(work, settings);
        if (!validation.ok || !validation.form) {
          results.push({
            workId: work.id,
            workName: work.name,
            ok: false,
            message: validation.reason ?? "校验失败",
          });
          continue;
        }

        try {
          const payload = await buildDraftPayloadFromForm(
            work,
            validation.form,
            settings
          );
          if (!payload) {
            results.push({
              workId: work.id,
              workName: work.name,
              ok: false,
              message: "无法构建草稿内容",
            });
            continue;
          }

          const result = await createWechatDraftFromWork(settings, payload);
          results.push({
            workId: work.id,
            workName: work.name,
            ok: true,
            message: `已创建（${result.mediaId.slice(0, 12)}…）`,
          });
        } catch (err) {
          results.push({
            workId: work.id,
            workName: work.name,
            ok: false,
            message: err instanceof Error ? err.message : "创建失败",
          });
        }
      }

      setBatchResults(results);
      const successCount = results.filter((item) => item.ok).length;
      const failCount = results.length - successCount;
      if (successCount > 0) {
        setCreateSuccess(
          `批量完成：成功 ${successCount} 个${failCount > 0 ? `，失败 ${failCount} 个` : ""}`
        );
        await loadDrafts();
      } else {
        setCreateError("批量上传全部失败，请查看下方明细");
      }
    } finally {
      setCreating(false);
      setBatchProgress(null);
    }
  }, [batchSelectedWorkIds, works, settings, loadDrafts]);

  const handleDeleteDraft = useCallback(
    async (mediaId: string) => {
      if (!window.confirm("确定删除该草稿？")) return;
      try {
        await deleteWechatDraft(settings, mediaId);
        await loadDrafts();
      } catch (err) {
        setListError(err instanceof Error ? err.message : "删除失败");
      }
    },
    [settings, loadDrafts]
  );

  const handleManualUploadCover = useCallback(async () => {
    if (!selectedWork || !coverId) {
      setCreateError("请先选择作品与封面来源");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const composedCache = new Map<string, string>();
      const coverImageSrc = await resolveWechatCoverImageSrc(
        selectedWork,
        contentOptions,
        coverId,
        composedCache
      );
      if (!coverImageSrc) {
        setCreateError("无法解析封面图片");
        return;
      }
      const result = await uploadWechatMaterial(settings, coverImageSrc);
      setCreateSuccess(
        `封面素材已上传，thumb_media_id: ${result.mediaId.slice(0, 16)}…`
      );
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "上传素材失败");
    } finally {
      setCreating(false);
    }
  }, [selectedWork, coverId, contentOptions, settings]);

  if (!mounted) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="微信公众号"
        description="从作品选择封面和正文内容，一键上传素材并创建公众号草稿。"
      />

      <div className="mb-8 grid gap-6">
        <WechatSettingsCard
          settings={settings}
          onChange={setSettings}
          ready={mounted}
        />

        <Card>
          <CardHeader>
            <CardTitle>从作品创建草稿</CardTitle>
            <CardDescription>
              支持单个或批量上传；作品默认套用公众号发布模板。可在{" "}
              <Link href="/my-works" className="text-primary underline-offset-4 hover:underline">
                作品管理
              </Link>{" "}
              中先保存作品。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={uploadMode === "single" ? "default" : "outline"}
                disabled={creating}
                onClick={() => {
                  setUploadMode("single");
                  setCreateError(null);
                  setCreateSuccess(null);
                  setBatchResults(null);
                }}
              >
                单个上传
              </Button>
              <Button
                type="button"
                size="sm"
                variant={uploadMode === "batch" ? "default" : "outline"}
                disabled={creating}
                onClick={() => {
                  setUploadMode("batch");
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
              >
                批量上传
              </Button>
            </div>

            {uploadMode === "single" ? (
              <>
            <div className="space-y-2">
              <Label htmlFor="wechat-work-select">选择作品</Label>
              <select
                id="wechat-work-select"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedWorkId}
                onChange={(e) => setSelectedWorkId(e.target.value)}
              >
                <option value="">— 请选择 —</option>
                {works.map((work) => (
                  <option key={work.id} value={work.id}>
                    {work.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedWork && (
              <WechatDraftMetaForm
                title={title}
                titleSourceKey={titleSourceKey}
                author={author}
                useFixedAuthor={useFixedAuthor}
                digest={digest}
                digestSourceKey={digestSourceKey}
                contentSourceUrl={contentSourceUrl}
                needOpenComment={needOpenComment}
                onlyFansCanComment={onlyFansCanComment}
                fixedAuthor={settings.defaultAuthor}
                textFields={workTextFields}
                onTitleChange={setTitle}
                onTitleSourceKeyChange={handleTitleSourceKeyChange}
                onAuthorChange={setAuthor}
                onUseFixedAuthorChange={handleUseFixedAuthorChange}
                onDigestChange={setDigest}
                onDigestSourceKeyChange={handleDigestSourceKeyChange}
                onContentSourceUrlChange={setContentSourceUrl}
                onNeedOpenCommentChange={(open) => {
                  setNeedOpenComment(open);
                  if (!open) setOnlyFansCanComment(false);
                }}
                onOnlyFansCanCommentChange={setOnlyFansCanComment}
                disabled={creating}
              />
            )}

            {selectedWork && (
              <WechatContentPicker
                options={contentOptions}
                coverId={coverId}
                bodyIds={bodyIds}
                onCoverChange={setCoverId}
                onBodyChange={setBodyIds}
                disabled={creating || useCustomHtml}
              />
            )}

            <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  checked={useCustomHtml}
                  onChange={(e) => setUseCustomHtml(e.target.checked)}
                />
                使用自定义 HTML 作为正文（忽略上方正文勾选）
              </label>
              {useCustomHtml && (
                <Textarea
                  id="wechat-draft-content"
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  placeholder="<p>自定义正文 HTML</p>"
                  rows={5}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  creating ||
                  !settings.appId ||
                  !settings.appSecret ||
                  !selectedWorkId ||
                  !coverId
                }
                onClick={() => void handleCreateFromWork()}
              >
                {creating ? (
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                上传素材并创建草稿
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={creating || !selectedWorkId || !coverId}
                onClick={() => void handleManualUploadCover()}
              >
                仅上传封面素材
              </Button>
            </div>
              </>
            ) : (
              <>
                <WechatBatchWorkPicker
                  works={works}
                  selectedIds={batchSelectedWorkIds}
                  onSelectionChange={setBatchSelectedWorkIds}
                  getWorkStatus={getWorkBatchStatus}
                  disabled={creating}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={
                      creating ||
                      !settings.appId ||
                      !settings.appSecret ||
                      batchSelectedWorkIds.length === 0
                    }
                    onClick={() => void handleBatchCreate()}
                  >
                    {creating ? (
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    批量上传草稿
                  </Button>
                </div>
                {batchProgress && (
                  <p className="text-sm text-muted-foreground">
                    正在上传 {batchProgress.current}/{batchProgress.total}：
                    {batchProgress.workName}
                  </p>
                )}
                {batchResults && batchResults.length > 0 && (
                  <ul className="space-y-1 rounded-lg border bg-muted/10 p-3 text-sm">
                    {batchResults.map((item) => (
                      <li
                        key={item.workId}
                        className={item.ok ? "text-green-600" : "text-destructive"}
                      >
                        {item.workName}：{item.message}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            {createSuccess && (
              <p className="text-sm text-green-600">{createSuccess}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>草稿箱</CardTitle>
              <CardDescription>
                共 {draftTotal} 篇草稿（官方草稿箱 API）
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingDrafts}
              onClick={() => void loadDrafts()}
            >
              {loadingDrafts ? (
                <LoadingSpinner className="mr-2 h-4 w-4" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              刷新
            </Button>
          </CardHeader>
          <CardContent>
            {listError && (
              <p className="mb-4 text-sm text-destructive">{listError}</p>
            )}
            {loadingDrafts && drafts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner className="h-4 w-4" />
                加载中…
              </div>
            ) : drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无草稿</p>
            ) : (
              <ul className="divide-y">
                {drafts.map((item) => (
                  <li
                    key={item.media_id}
                    className="flex items-center gap-4 py-4"
                  >
                    {getDraftThumb(item) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getDraftThumb(item)!}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        无图
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{getDraftTitle(item)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        更新于 {formatDate(new Date(item.update_time * 1000))}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        {item.media_id}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        草稿
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="删除草稿"
                        onClick={() => void handleDeleteDraft(item.media_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              在{" "}
              <a
                href="https://mp.weixin.qq.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                微信公众平台
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              素材管理与草稿箱中查看、编辑与发布。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
