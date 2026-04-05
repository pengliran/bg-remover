import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/google-auth";
import { getUserByGoogleId } from "@/lib/db";

export const runtime = "edge";

// GET /api/auth/me — 获取当前登录用户信息（从 D1 同步）
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ user: null });
  }

  try {
    const userData = JSON.parse(Buffer.from(sessionCookie, "base64").toString());
    const { token, ...userInfo } = userData;

    // 从 D1 获取最新的套餐和积分信息
    let syncedInfo = { ...userInfo };
    if (userData.id) {
      try {
        const dbUser = await getUserByGoogleId(userData.id);
        if (dbUser) {
          syncedInfo = {
            ...userInfo,
            plan: dbUser.plan || "free",
            credits: dbUser.credits || 0,
            subscriptionExpires: dbUser.subscription_expires || null,
          };
          // 更新 cookie 中的套餐信息
          const newCookieData = JSON.stringify({
            ...userData,
            plan: dbUser.plan || "free",
            credits: dbUser.credits || 0,
            subscriptionExpires: dbUser.subscription_expires || null,
          });
          const encoded = Buffer.from(newCookieData).toString("base64");
          const res = NextResponse.json({ user: syncedInfo });
          res.cookies.set(SESSION_COOKIE, encoded, {
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60,
          });
          return res;
        }
      } catch (dbErr) {
        console.error("D1 sync error:", dbErr);
        // D1 查询失败时，仍返回 cookie 中的信息
      }
    }

    return NextResponse.json({ user: syncedInfo });
  } catch {
    return NextResponse.json({ user: null });
  }
}
