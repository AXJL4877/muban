/** 数据统计通用日期范围 */
export interface WechatDatacubeDateRange {
  begin_date: string;
  end_date: string;
}

/** 获取用户增减数据 - 单条记录 */
export interface WechatUserSummaryItem {
  ref_date: string;
  user_source: number;
  new_user: number;
  cancel_user: number;
}

export interface WechatUserSummaryResult {
  list: WechatUserSummaryItem[];
}

/** 获取累计用户数据 - 单条记录 */
export interface WechatUserCumulateItem {
  ref_date: string;
  cumulate_user: number;
}

export interface WechatUserCumulateResult {
  list: WechatUserCumulateItem[];
}

/** 获取发表内容每日阅读数据 */
export interface WechatArticleReadSourceItem {
  user_count: number;
  scene_desc: string;
}

export interface WechatArticleReadDetail {
  read_user: number;
  read_user_source: WechatArticleReadSourceItem[];
}

export interface WechatArticleReadItem {
  ref_date: string;
  msgid: string;
  detail: WechatArticleReadDetail;
}

export interface WechatArticleReadResult {
  list: WechatArticleReadItem[];
  is_delay?: boolean | string;
}

/** 按日期聚合后的用户增减 */
export interface WechatUserDailySummary {
  ref_date: string;
  new_user: number;
  cancel_user: number;
  net_user: number;
}

/** 前端展示用的分析汇总 */
export interface WechatAnalyticsSummary {
  beginDate: string;
  endDate: string;
  latestCumulateUser: number | null;
  totalNewUser: number;
  totalCancelUser: number;
  totalNetUser: number;
  totalReadUser: number;
  articleCount: number;
  isArticleDataDelayed: boolean;
}

export interface WechatAnalyticsResponse {
  summary: WechatAnalyticsSummary;
  userDaily: WechatUserDailySummary[];
  cumulate: WechatUserCumulateItem[];
  userBySource: WechatUserSummaryItem[];
  articleReads: WechatArticleReadItem[];
}
