import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/google-auth";

export const runtime = "edge";

// POST /api/auth/logout — 登出
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
