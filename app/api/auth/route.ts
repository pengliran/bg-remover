import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_CLIENT_ID,
  getRedirectUri,
  generateState,
  STATE_COOKIE,
} from "@/lib/google-auth";

export const runtime = "edge";

// GET /api/auth — 重定向到 Google 登录页面
export async function GET(request: NextRequest) {
  const state = generateState();
  const redirectUri = getRedirectUri(request);

  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: state,
      access_type: "offline",
      prompt: "select_account",
    }).toString();

  const response = NextResponse.redirect(googleAuthUrl);

  // 设置 state cookie 用于 CSRF 验证
  response.cookies.set(STATE_COOKIE, state, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 分钟有效
  });

  return response;
}
