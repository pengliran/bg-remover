// Google OAuth 配置
// 凭据通过 Cloudflare Pages 环境变量注入，不要硬编码在代码中
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// 动态生成 redirect_uri（基于当前请求的 host）
export function getRedirectUri(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/auth/callback/google`;
}

// 生成随机 state 防 CSRF
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// 生成 session token
export function generateSessionToken(): string {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cookie 名称
export const SESSION_COOKIE = "bg_remover_session";
export const STATE_COOKIE = "bg_remover_oauth_state";
