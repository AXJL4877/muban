import type {
  WechatAnalyticsResponse,
  WechatAnalyticsSummary,
  WechatArticleReadItem,
  WechatUserCumulateItem,
  WechatUserDailySummary,
  WechatUserSummaryItem,
} from "@/types/wechat-analytics";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 默认查询最近 7 天（不含今天，微信数据建议查昨日及之前） */
export function getDefaultAnalyticsRange(): { beginDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const begin = new Date(end);
  begin.setDate(begin.getDate() - 6);
  return {
    beginDate: formatDateYmd(begin),
    endDate: formatDateYmd(end),
  };
}

export function enumerateDates(beginDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${beginDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(formatDateYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function validateAnalyticsDateRange(
  beginDate: string,
  endDate: string
): string | null {
  if (!isValidDateString(beginDate) || !isValidDateString(endDate)) {
    return "日期格式应为 YYYY-MM-DD";
  }
  if (beginDate > endDate) {
    return "开始日期不能晚于结束日期";
  }
  const days = enumerateDates(beginDate, endDate).length;
  if (days > 7) {
    return "日期跨度不能超过 7 天（微信接口限制）";
  }
  const yesterday = formatDateYmd(new Date(Date.now() - 86400000));
  if (endDate > yesterday) {
    return "结束日期不能晚于昨天（建议每日 8 点后查询前一日数据）";
  }
  return null;
}

/** 用户渠道编码 → 中文说明 */
export const WECHAT_USER_SOURCE_LABELS: Record<number, string> = {
  0: "其他合计",
  1: "公众号搜索",
  17: "名片分享",
  30: "扫描二维码",
  57: "文章内账号名称",
  100: "微信广告",
  149: "小程序关注",
  161: "他人转载",
  200: "视频号",
  201: "直播",
};

export function getUserSourceLabel(source: number): string {
  return WECHAT_USER_SOURCE_LABELS[source] ?? `渠道 ${source}`;
}

export function aggregateUserDaily(
  items: WechatUserSummaryItem[]
): WechatUserDailySummary[] {
  const map = new Map<string, WechatUserDailySummary>();
  for (const item of items) {
    const existing = map.get(item.ref_date) ?? {
      ref_date: item.ref_date,
      new_user: 0,
      cancel_user: 0,
      net_user: 0,
    };
    existing.new_user += item.new_user;
    existing.cancel_user += item.cancel_user;
    existing.net_user = existing.new_user - existing.cancel_user;
    map.set(item.ref_date, existing);
  }
  return [...map.values()].sort((a, b) => a.ref_date.localeCompare(b.ref_date));
}

export function buildAnalyticsSummary(
  beginDate: string,
  endDate: string,
  userDaily: WechatUserDailySummary[],
  cumulate: WechatUserCumulateItem[],
  articleReads: WechatArticleReadItem[],
  isArticleDataDelayed: boolean
): WechatAnalyticsSummary {
  const totalNewUser = userDaily.reduce((sum, d) => sum + d.new_user, 0);
  const totalCancelUser = userDaily.reduce((sum, d) => sum + d.cancel_user, 0);
  const sortedCumulate = [...cumulate].sort((a, b) =>
    a.ref_date.localeCompare(b.ref_date)
  );
  const latestCumulateUser =
    sortedCumulate.length > 0
      ? sortedCumulate[sortedCumulate.length - 1].cumulate_user
      : null;

  const totalReadUser = articleReads.reduce(
    (sum, item) => sum + (item.detail?.read_user ?? 0),
    0
  );

  return {
    beginDate,
    endDate,
    latestCumulateUser,
    totalNewUser,
    totalCancelUser,
    totalNetUser: totalNewUser - totalCancelUser,
    totalReadUser,
    articleCount: articleReads.length,
    isArticleDataDelayed,
  };
}

export function buildAnalyticsResponse(
  beginDate: string,
  endDate: string,
  userBySource: WechatUserSummaryItem[],
  cumulate: WechatUserCumulateItem[],
  articleReads: WechatArticleReadItem[],
  isArticleDataDelayed: boolean
): WechatAnalyticsResponse {
  const userDaily = aggregateUserDaily(userBySource);
  const summary = buildAnalyticsSummary(
    beginDate,
    endDate,
    userDaily,
    cumulate,
    articleReads,
    isArticleDataDelayed
  );
  return {
    summary,
    userDaily,
    cumulate: [...cumulate].sort((a, b) => a.ref_date.localeCompare(b.ref_date)),
    userBySource,
    articleReads,
  };
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatSignedNumber(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)}`;
}
