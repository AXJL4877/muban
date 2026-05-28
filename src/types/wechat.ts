/** 公众号接口凭证（与 AI 设置类似，由前端 localStorage 传入 API） */
export interface WechatCredentials {
  appId: string;
  appSecret: string;
}

export interface WechatSettingsStore extends WechatCredentials {
  /** 默认图文作者 */
  defaultAuthor?: string;
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
}
