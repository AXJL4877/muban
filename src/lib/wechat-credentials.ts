/** 微信公众号 AppID 一般为 wx 开头的 18 位字符串 */
const WECHAT_APP_ID_RE = /^wx[a-z0-9]{16}$/i;

export function isValidWechatAppId(appId: string | undefined | null): boolean {
  const value = appId?.trim() ?? "";
  return WECHAT_APP_ID_RE.test(value);
}

export function isValidWechatAppSecret(appSecret: string | undefined | null): boolean {
  const value = appSecret?.trim() ?? "";
  return value.length >= 16;
}

export function validateWechatCredentials(
  appId: string | undefined | null,
  appSecret: string | undefined | null
): string | null {
  if (!appId?.trim() || !appSecret?.trim()) {
    return "请配置公众号 AppID 与 AppSecret";
  }
  if (!isValidWechatAppId(appId)) {
    return "AppID 格式无效，应为微信公众平台上的 wx 开头 18 位 ID（当前不是有效 AppID）";
  }
  if (!isValidWechatAppSecret(appSecret)) {
    return "AppSecret 长度不足，请检查是否填写完整";
  }
  return null;
}
