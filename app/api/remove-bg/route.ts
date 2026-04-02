import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/google-auth";

export const runtime = "edge";

// 用量配置
const FREE_GUEST_LIMIT = 3;
const FREE_USER_LIMIT = 10;
const PLANS: Record<string, number> = {
  free: 10,
  basic: 100,
  pro: 500,
  unlimited: Infinity,
};

// 今天的日期 key
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Cookie-based 用量追踪（轻量方案，后续迁移到 D1）
function getUsageFromCookie(request: NextRequest): {
  usedToday: number;
  date: string;
} {
  const raw = request.cookies.get("bg_remover_usage")?.value;
  if (!raw) return { usedToday: 0, date: getTodayKey() };

  try {
    const data = JSON.parse(atob(raw));
    return {
      usedToday: data.date === getTodayKey() ? data.count : 0,
      date: data.date,
    };
  } catch {
    return { usedToday: 0, date: getTodayKey() };
  }
}

function setUsageCookie(
  response: NextResponse,
  count: number
): NextResponse {
  const encoded = btoa(JSON.stringify({ count, date: getTodayKey() }));
  response.cookies.set("bg_remover_usage", encoded, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 86400, // 24 小时
  });
  return response;
}

// 获取用户信息
function getUserFromCookie(request: NextRequest): {
  id: string;
  email: string;
  plan: string;
} | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const userData = JSON.parse(atob(raw));
    return {
      id: userData.id,
      email: userData.email,
      plan: userData.plan || "free",
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.REMOVE_BG_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Remove.bg API key is not configured." },
      { status: 500 }
    );
  }

  // 1. 检查用量限制
  const user = getUserFromCookie(request);
  const usage = getUsageFromCookie(request);

  let limit: number;

  if (!user) {
    // 未登录游客
    limit = FREE_GUEST_LIMIT;
  } else {
    // 已登录用户
    limit = PLANS[user.plan] || FREE_USER_LIMIT;
  }

  if (usage.usedToday >= limit) {
    return NextResponse.json(
      {
        error: "Usage limit reached",
        limit,
        usedToday: usage.usedToday,
        isGuest: !user,
      },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    // 2. 调用 Remove.bg API
    const apiFormData = new FormData();
    apiFormData.append("image_file", imageFile);
    apiFormData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { errors?: Array<{ title: string }> })?.errors?.[0]
          ?.title || `Remove.bg API error: ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    // 3. 成功 — 更新用量
    const newCount = usage.usedToday + 1;
    const imageBuffer = await response.arrayBuffer();

    const res = new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // 返回剩余次数到 header
        "X-Usage-Remaining": String(Math.max(0, limit - newCount)),
        "X-Usage-Limit": String(limit),
        "X-Usage-Used": String(newCount),
      },
    });

    setUsageCookie(res, newCount);
    return res;
  } catch (err) {
    console.error("Remove BG error:", err);
    return NextResponse.json(
      { error: "Failed to process image. Please try again." },
      { status: 500 }
    );
  }
}

// GET /api/remove-bg — 返回当前用量信息
export async function GET(request: NextRequest) {
  const user = getUserFromCookie(request);
  const usage = getUsageFromCookie(request);

  let limit: number;
  if (!user) {
    limit = FREE_GUEST_LIMIT;
  } else {
    limit = PLANS[user.plan] || FREE_USER_LIMIT;
  }

  return NextResponse.json({
    usedToday: usage.usedToday,
    limit,
    remaining: Math.max(0, limit - usage.usedToday),
    isGuest: !user,
    plan: user?.plan || "guest",
  });
}
