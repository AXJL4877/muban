/** 常见微信 errcode 的中文说明与排查建议 */
const WECHAT_ERROR_HINTS: Record<number, string> = {
  48001:
    "当前公众号未获得数据统计接口权限。请确认：① 账号已完成微信认证（企业主体）；② 在公众平台「设置与开发 → 开发者接口管理」中已开通用户分析、内容分析相关权限；③ AppID/AppSecret 来自该公众号（非小程序、非其他账号）。订阅号部分统计能力可能受限，服务号支持最完整。",
  40001:
    "access_token 无效。请确认：① AppID 与 AppSecret 来自同一公众号且填写正确；② 若刚重置过 AppSecret，请用新密钥保存配置后再试；③ 不要在公众平台后台与其他程序同时频繁刷新旧版 token。本项目已改用微信「稳定版 access_token」接口。",
  61500: "日期格式错误，请使用 YYYY-MM-DD。",
  61501: "日期跨度超出限制：用户数据最多 7 天，发表内容阅读每次仅 1 天。",
  61503:
    "指定日期的数据尚未生成，请于次日 8 点后再查询前一日数据。",
};

export function formatWechatApiError(errcode: number, errmsg: string): string {
  const hint = WECHAT_ERROR_HINTS[errcode];
  const base = `微信接口错误 (${errcode}): ${errmsg}`;
  return hint ? `${base}\n\n${hint}` : base;
}
