/** 公众号接口凭证（与 AI 设置类似，由前端 localStorage 传入 API） */
export interface WechatCredentials {
  appId: string;
  appSecret: string;
}

export type WechatBodyContentPattern = "composed" | "text" | "image" | "cover";

export interface WechatSettingsStore extends WechatCredentials {
  /** 固定作者（创建草稿时默认填入） */
  defaultAuthor?: string;
  /** 默认标题来源：作品 JSON 字段 elementId，或 __work_name__ */
  defaultTitleFieldKey?: string;
  /** 默认摘要来源：作品 JSON 字段 elementId */
  defaultDigestFieldKey?: string;
  /** 默认是否打开评论 */
  needOpenComment?: boolean;
  /** 默认是否仅粉丝可评论（需先打开评论） */
  onlyFansCanComment?: boolean;
  /** 新作品默认封面（稳定 id：cover-thumbnail / composed-canvas 等） */
  defaultPublishCoverId?: string;
  /**
   * 新作品默认正文勾选模式（按类型匹配，可跨作品复用）
   * 例：["composed"] = 仅合成整图
   */
  defaultPublishBodyPattern?: WechatBodyContentPattern[];
}

export interface WechatApiErrorBody {
  errcode: number;
  errmsg: string;
}

export interface WechatAccessTokenResult {
  access_token: string;
  expires_in: number;
}

export interface WechatMaterialUploadResult {
  media_id: string;
  url?: string;
}

export interface WechatDraftArticle {
  article_type?: "news";
  title: string;
  author?: string;
  digest?: string;
  content: string;
  content_source_url?: string;
  thumb_media_id: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

export interface WechatDraftAddResult {
  media_id: string;
}

export interface WechatDraftListItem {
  media_id: string;
  content: {
    news_item: Array<{
      title: string;
      author: string;
      digest: string;
      thumb_url?: string;
      url?: string;
      content?: string;
    }>;
  };
  update_time: number;
}

export interface WechatDraftBatchGetResult {
  total_count: number;
  item_count: number;
  item: WechatDraftListItem[];
}

export interface WechatDraftCountResult {
  total_count: number;
}

export interface WechatDraftGetResult {
  news_item: WechatDraftListItem["content"]["news_item"];
}

export interface WechatDraftContentBlock {
  type: "text" | "image";
  text?: string;
  imageSrc?: string;
}

export interface CreateDraftFromWorkPayload {
  credentials: WechatCredentials;
  title: string;
  author?: string;
  digest?: string;
  /** 自定义 HTML，填写时忽略 contentBlocks */
  content?: string;
  contentSourceUrl?: string;
  /** 封面图：data URL 或 http(s) URL */
  coverImageSrc: string;
  /** 按顺序组装的正文块 */
  contentBlocks?: WechatDraftContentBlock[];
  /** @deprecated 使用 contentBlocks */
  contentImageSrcs?: string[];
  needOpenComment?: boolean;
  onlyFansCanComment?: boolean;
}
