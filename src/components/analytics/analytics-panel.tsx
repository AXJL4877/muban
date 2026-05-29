"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { DualBarChart, SimpleBarChart } from "@/components/analytics/simple-bar-chart";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/motion/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchWechatAnalytics } from "@/lib/wechat-analytics-client";
import {
  formatNumber,
  formatSignedNumber,
  getDefaultAnalyticsRange,
  getUserSourceLabel,
} from "@/lib/wechat-analytics";
import { useWechatSettings } from "@/components/wechat/wechat-settings-card";
import type { WechatAnalyticsResponse } from "@/types/wechat-analytics";

function MetricCard({
  title,
  value,
  description,
  accent,
}: {
  title: string;
  value: string;
  description?: string;
  accent?: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    accent === "positive"
      ? "text-emerald-600"
      : accent === "negative"
        ? "text-rose-600"
        : "text-foreground";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel() {
  const { settings, mounted } = useWechatSettings();
  const defaultRange = useMemo(() => getDefaultAnalyticsRange(), []);
  const [beginDate, setBeginDate] = useState(defaultRange.beginDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [data, setData] = useState<WechatAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCredentials =
    mounted && Boolean(settings.appId.trim() && settings.appSecret.trim());

  const loadData = useCallback(async () => {
    if (!hasCredentials) {
      setError("请先在「微信公众号」页面配置 AppID 与 AppSecret");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWechatAnalytics(settings, beginDate, endDate);
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [hasCredentials, settings, beginDate, endDate]);

  useEffect(() => {
    if (hasCredentials) {
      void loadData();
    }
  }, [hasCredentials]); // eslint-disable-line react-hooks/exhaustive-deps -- 仅在凭证就绪后自动加载一次

  const chartLabels = data?.userDaily.map((d) => d.ref_date) ?? [];
  const cumulateValues = data?.cumulate.map((d) => d.cumulate_user) ?? [];
  const newUserValues = data?.userDaily.map((d) => d.new_user) ?? [];
  const cancelUserValues = data?.userDaily.map((d) => d.cancel_user) ?? [];

  const sourceSummary = useMemo(() => {
    if (!data?.userBySource.length) return [];
    const map = new Map<number, { new_user: number; cancel_user: number }>();
    for (const item of data.userBySource) {
      const existing = map.get(item.user_source) ?? {
        new_user: 0,
        cancel_user: 0,
      };
      existing.new_user += item.new_user;
      existing.cancel_user += item.cancel_user;
      map.set(item.user_source, existing);
    }
    return [...map.entries()]
      .map(([source, stats]) => ({
        source,
        label: getUserSourceLabel(source),
        ...stats,
        net: stats.new_user - stats.cancel_user,
      }))
      .filter((s) => s.new_user > 0 || s.cancel_user > 0)
      .sort((a, b) => b.new_user - a.new_user);
  }, [data?.userBySource]);

  const articleByDate = useMemo(() => {
    if (!data?.articleReads.length) return [];
    const map = new Map<string, { read_user: number; count: number }>();
    for (const item of data.articleReads) {
      const existing = map.get(item.ref_date) ?? { read_user: 0, count: 0 };
      existing.read_user += item.detail?.read_user ?? 0;
      existing.count += 1;
      map.set(item.ref_date, existing);
    }
    return [...map.entries()]
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data?.articleReads]);

  return (
    <div className="p-8">
      <PageHeader
        title="数据分析"
        description="接入微信公众号数据统计接口：用户增减、累计用户、发表内容每日阅读"
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="begin-date">开始日期</Label>
          <Input
            id="begin-date"
            type="date"
            value={beginDate}
            onChange={(e) => setBeginDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">结束日期</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={() => void loadData()} disabled={loading || !hasCredentials}>
          {loading ? (
            <LoadingSpinner className="mr-2" label="加载中" />
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新数据
            </>
          )}
        </Button>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        数据说明：用户接口最多查询 7 天；发表内容阅读数据按天分别拉取；建议每日 8 点后查询前一日数据。
        发表内容阅读数据自 2025-11-01 起有效。
      </p>

      {!mounted ? (
        <LoadingSpinner label="正在读取公众号配置…" />
      ) : !hasCredentials ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">尚未配置公众号凭证</p>
              <p className="text-muted-foreground">
                请前往
                <Link href="/wechat" className="mx-1 text-primary underline">
                  微信公众号
                </Link>
                页面配置 AppID 与 AppSecret。
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardContent className="space-y-2 pt-6 text-sm text-destructive">
            {error.split("\n\n").map((paragraph, i) => (
              <p key={i} className={i > 0 ? "text-muted-foreground" : undefined}>
                {paragraph}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="累计关注用户"
              value={formatNumber(data.summary.latestCumulateUser)}
              description={`截至 ${data.summary.endDate}`}
            />
            <MetricCard
              title="净增用户"
              value={formatSignedNumber(data.summary.totalNetUser)}
              description={`${data.summary.beginDate} ~ ${data.summary.endDate}`}
              accent={
                data.summary.totalNetUser > 0
                  ? "positive"
                  : data.summary.totalNetUser < 0
                    ? "negative"
                    : "neutral"
              }
            />
            <MetricCard
              title="新增关注"
              value={formatNumber(data.summary.totalNewUser)}
              description="各渠道合计"
            />
            <MetricCard
              title="发表内容阅读"
              value={formatNumber(data.summary.totalReadUser)}
              description={`${data.summary.articleCount} 篇文章${data.summary.isArticleDataDelayed ? " · 数据可能有延迟" : ""}`}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>累计用户趋势</CardTitle>
                <CardDescription>接口：getusercumulate</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart
                  labels={chartLabels}
                  values={cumulateValues}
                  valueFormatter={(v) => formatNumber(v)}
                  barClassName="bg-blue-500/80"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>用户增减趋势</CardTitle>
                <CardDescription>接口：getusersummary</CardDescription>
              </CardHeader>
              <CardContent>
                <DualBarChart
                  labels={chartLabels}
                  primaryValues={newUserValues}
                  secondaryValues={cancelUserValues}
                  primaryLabel="新增"
                  secondaryLabel="取关"
                />
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>发表内容每日阅读</CardTitle>
              <CardDescription>接口：getarticleread</CardDescription>
            </CardHeader>
            <CardContent>
              {data.articleReads.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  所选日期内暂无阅读数据（若当天无文章指标变化，接口返回为空）
                </p>
              ) : (
                <div className="space-y-6">
                  {articleByDate.length > 1 && (
                    <SimpleBarChart
                      labels={articleByDate.map((d) => d.date)}
                      values={articleByDate.map((d) => d.read_user)}
                      valueFormatter={(v) => formatNumber(v)}
                      barClassName="bg-violet-500/80"
                    />
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">日期</th>
                          <th className="pb-2 pr-4 font-medium">消息 ID</th>
                          <th className="pb-2 pr-4 font-medium text-right">阅读人数</th>
                          <th className="pb-2 font-medium">阅读来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.articleReads.map((item) => (
                          <tr key={`${item.ref_date}-${item.msgid}`} className="border-b last:border-0">
                            <td className="py-2.5 pr-4 whitespace-nowrap">{item.ref_date}</td>
                            <td className="py-2.5 pr-4 font-mono text-xs">{item.msgid}</td>
                            <td className="py-2.5 pr-4 text-right font-medium">
                              {formatNumber(item.detail?.read_user)}
                            </td>
                            <td className="py-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                {(item.detail?.read_user_source ?? []).map((src) => (
                                  <span
                                    key={`${item.msgid}-${src.scene_desc}`}
                                    className="rounded-md bg-muted px-2 py-0.5 text-xs"
                                  >
                                    {src.scene_desc}: {formatNumber(src.user_count)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {sourceSummary.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>新增用户渠道分布</CardTitle>
                <CardDescription>统计区间内各渠道新增与取关</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">渠道</th>
                        <th className="pb-2 pr-4 font-medium text-right">新增</th>
                        <th className="pb-2 pr-4 font-medium text-right">取关</th>
                        <th className="pb-2 font-medium text-right">净增</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceSummary.map((row) => (
                        <tr key={row.source} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">{row.label}</td>
                          <td className="py-2.5 pr-4 text-right text-emerald-600">
                            +{formatNumber(row.new_user)}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-rose-500">
                            -{formatNumber(row.cancel_user)}
                          </td>
                          <td className="py-2.5 text-right font-medium">
                            {formatSignedNumber(row.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
