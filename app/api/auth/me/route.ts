import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/google-auth";

export const runtime = "edge";

// GET /api/auth/me — 获取当前登录用户信息
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ user: null });
  }

  try {
    const userData = JSON.parse(Buffer.from(sessionCookie, "base64").toString());
    // 不返回 token
    const { token: _, ...user } = userData;
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
