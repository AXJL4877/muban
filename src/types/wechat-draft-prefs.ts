import type { WechatSettingsStore } from "@/types/wechat";

/** 单个作品的草稿创建偏好（服务端持久化） */
export interface WechatWorkDraftPrefs {
  coverId: string;
  bodyIds: string[];
  titleSourceKey: string;
  title: string;
  digestSourceKey: string;
  digest: string;
  useFixedAuthor: boolean;
  author: string;
  contentSourceUrl: string;
  needOpenComment: boolean;
  onlyFansCanComment: boolean;
  useCustomHtml: boolean;
  customContent: string;
  updatedAt: number;
}

export interface WechatPrefsStore {
  version: 1;
  settings: WechatSettingsStore;
  workPrefs: Record<string, WechatWorkDraftPrefs>;
  lastSelectedWorkId?: string;
}

export interface WechatPrefsPatch {
  settings?: WechatSettingsStore;
  workId?: string;
  workPrefs?: WechatWorkDraftPrefs;
  lastSelectedWorkId?: string;
}
