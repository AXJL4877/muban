"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WECHAT_TEXT_SOURCE_MANUAL,
  WECHAT_TITLE_SOURCE_WORK_NAME,
  type WorkTextField,
} from "@/lib/wechat-work-text-fields";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

interface WechatDraftMetaFormProps {
  title: string;
  titleSourceKey: string;
  author: string;
  useFixedAuthor: boolean;
  digest: string;
  digestSourceKey: string;
  contentSourceUrl: string;
  needOpenComment: boolean;
  onlyFansCanComment: boolean;
  fixedAuthor?: string;
  textFields: WorkTextField[];
  onTitleChange: (value: string) => void;
  onTitleSourceKeyChange: (key: string) => void;
  onAuthorChange: (value: string) => void;
  onUseFixedAuthorChange: (value: boolean) => void;
  onDigestChange: (value: string) => void;
  onDigestSourceKeyChange: (key: string) => void;
  onContentSourceUrlChange: (value: string) => void;
  onNeedOpenCommentChange: (value: boolean) => void;
  onOnlyFansCanCommentChange: (value: boolean) => void;
  disabled?: boolean;
}

export function WechatDraftMetaForm({
  title,
  titleSourceKey,
  author,
  useFixedAuthor,
  digest,
  digestSourceKey,
  contentSourceUrl,
  needOpenComment,
  onlyFansCanComment,
  fixedAuthor,
  textFields,
  onTitleChange,
  onTitleSourceKeyChange,
  onAuthorChange,
  onUseFixedAuthorChange,
  onDigestChange,
  onDigestSourceKeyChange,
  onContentSourceUrlChange,
  onNeedOpenCommentChange,
  onOnlyFansCanCommentChange,
  disabled,
}: WechatDraftMetaFormProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
      <p className="text-sm font-medium">草稿要素</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="wechat-title-source">标题来源</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              id="wechat-title-source"
              className={selectClassName}
              value={titleSourceKey}
              disabled={disabled}
              onChange={(e) => onTitleSourceKeyChange(e.target.value)}
            >
              <option value={WECHAT_TEXT_SOURCE_MANUAL}>手动填写</option>
              <option value={WECHAT_TITLE_SOURCE_WORK_NAME}>作品名称</option>
              {textFields.map((field) => (
                <option key={`title-${field.key}`} value={field.key}>
                  文字 · {field.label}
                </option>
              ))}
            </select>
            <Input
              id="wechat-draft-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="图文标题（公众号必填）"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="wechat-draft-author">作者</Label>
            {fixedAuthor && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border"
                  checked={useFixedAuthor}
                  disabled={disabled}
                  onChange={(e) => onUseFixedAuthorChange(e.target.checked)}
                />
                使用固定作者
              </label>
            )}
          </div>
          <Input
            id="wechat-draft-author"
            value={author}
            onChange={(e) => onAuthorChange(e.target.value)}
            placeholder={fixedAuthor ? `固定：${fixedAuthor}` : "可选"}
            disabled={disabled || (useFixedAuthor && !!fixedAuthor)}
          />
          {useFixedAuthor && fixedAuthor && (
            <p className="text-xs text-muted-foreground">
              已在公众号配置中设置固定作者，创建草稿时将自动使用。
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="wechat-digest-source">摘要来源</Label>
          <select
            id="wechat-digest-source"
            className={selectClassName}
            value={digestSourceKey}
            disabled={disabled}
            onChange={(e) => onDigestSourceKeyChange(e.target.value)}
          >
            <option value={WECHAT_TEXT_SOURCE_MANUAL}>手动填写 / 默认同标题</option>
            {textFields.map((field) => (
              <option key={`digest-${field.key}`} value={field.key}>
                文字 · {field.label}
              </option>
            ))}
          </select>
          <Input
            id="wechat-draft-digest"
            value={digest}
            onChange={(e) => onDigestChange(e.target.value)}
            placeholder="可选，留空则使用标题前 120 字"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="wechat-content-source-url">原文链接（可选）</Label>
          <Input
            id="wechat-content-source-url"
            value={contentSourceUrl}
            onChange={(e) => onContentSourceUrlChange(e.target.value)}
            placeholder="https://"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">评论设置</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border"
            checked={needOpenComment}
            disabled={disabled}
            onChange={(e) => onNeedOpenCommentChange(e.target.checked)}
          />
          打开评论
        </label>
        <label
          className={`flex items-center gap-2 text-sm ${
            needOpenComment ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border"
            checked={onlyFansCanComment}
            disabled={disabled || !needOpenComment}
            onChange={(e) => onOnlyFansCanCommentChange(e.target.checked)}
          />
          仅粉丝可评论
        </label>
      </div>
    </div>
  );
}
