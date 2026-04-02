import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  getRedirectUri,
  STATE_COOKIE,
  SESSION_COOKIE,
  generateSessionToken,
} from "@/lib/google-auth";

export const runtime = "edge";

// GET /api/auth/callback/google — 处理 Google 回调
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // 获取 cookie 中的 state
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  // 清除 state cookie
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(STATE_COOKIE);

  // 错误处理
  if (error) {
    return NextResponse.redirect(new URL("/?error=oauth_cancelled", request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=invalid_callback", request.url));
  }

  // CSRF 验证
  if (!cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  try {
    // 1. 用 code 换 access_token
    const redirectUri = getRedirectUri(request);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error("Token exchange failed");
    }

    const tokenData = await tokenRes.json();
    const { access_token } = tokenData;

    // 2. 用 access_token 获取用户信息
    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!userRes.ok) {
      throw new Error("Failed to fetch user info");
    }

    const userInfo = await userRes.json();
    const { id: googleId, email, name, picture: avatar } = userInfo;

    // 3. 生成 session 并通过 cookie 返回用户信息（加密 JWT 方式简化实现）
    const sessionToken = generateSessionToken();
    const userData = JSON.stringify({
      id: googleId,
      email,
      name,
      avatar,
      token: sessionToken,
    });

    // 用 base64 编码用户数据存入 cookie（Edge Runtime 下简化方案）
    const encoded = Buffer.from(userData).toString("base64");

    response.cookies.set(SESSION_COOKIE, encoded, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 天
    });

    return response;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
