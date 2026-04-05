import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/google-auth";
import { getUserByGoogleId, incrementUsage, getDailyUsage, getUsageLimit, getEffectivePlan } from "@/lib/db";

export const runtime = "edge";

// 用量配置
const FREE_GUEST_LIMIT = 3;
const FREE_USER_LIMIT = 10;

// 今天的日期 key
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// 获取用户信息（从 cookie）
function getUserFromCookie(request: NextRequest): {
  id: string;
  email: string;
  plan: string;
  dbUserId?: number;
} | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const userData = JSON.parse(atob(raw));
    return {
      id: userData.id,
      email: userData.email,
      plan: userData.plan || "free",
      dbUserId: userData.dbUserId,
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
  let limit: number;
  let usedToday = 0;
  let userId: number | null = null;

  if (!user) {
    // 未登录游客 — 用 cookie 计数（保持原逻辑）
    const raw = request.cookies.get("bg_remover_usage")?.value;
    if (raw) {
      try {
        const data = JSON.parse(atob(raw));
        usedToday = data.date === getTodayKey() ? data.count : 0;
      } catch {}
    }
    limit = FREE_GUEST_LIMIT;
  } else {
    // 已登录用户 — 从 D1 获取用量和套餐
    try {
      const dbUser = await getUserByGoogleId(user.id);
      if (dbUser) {
        userId = dbUser.id;
        const usageInfo = await getUsageLimit(dbUser);
        limit = usageInfo.totalLimit;
        usedToday = await getDailyUsage(dbUser.id);
      } else {
        limit = FREE_USER_LIMIT;
      }
    } catch (dbErr) {
      console.error("D1 query error, falling back to cookie:", dbErr);
      limit = user.plan === "free" ? FREE_USER_LIMIT : 500;
    }
  }

  if (usedToday >= limit) {
    return NextResponse.json(
      {
        error: "Usage limit reached",
        limit,
        usedToday,
        isGuest: !user,
        plan: user?.plan || "guest",
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
    const imageBuffer = await response.arrayBuffer();

    if (userId) {
      // 登录用户：D1 原子递增
      usedToday = await incrementUsage(userId, getTodayKey());
    } else if (user) {
      // 有 session 但 D1 查询失败的备用：用 cookie
      usedToday += 1;
    } else {
      // 游客：cookie 计数
      usedToday += 1;
    }

    const newCount = usedToday;
    const res = new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "X-Usage-Remaining": String(Math.max(0, limit - newCount)),
        "X-Usage-Limit": String(limit),
        "X-Usage-Used": String(newCount),
      },
    });

    // 游客：写 cookie
    if (!user) {
      const encoded = btoa(JSON.stringify({ count: newCount, date: getTodayKey() }));
      res.cookies.set("bg_remover_usage", encoded, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 86400,
      });
    }

    return res;
  } catch (err) {
    console.error("Remove BG error:", err);
    return NextResponse.json(
      { error: "Failed to process image. Please try again." },
      { status: 500 }
    );
  }
}

// GET /api/remove-bg — 返回当前用量信息（从 D1 读取）
export async function GET(request: NextRequest) {
  const user = getUserFromCookie(request);

  if (!user) {
    // 游客：cookie 计数
    const raw = request.cookies.get("bg_remover_usage")?.value;
    let usedToday = 0;
    if (raw) {
      try {
        const data = JSON.parse(atob(raw));
        usedToday = data.date === getTodayKey() ? data.count : 0;
      } catch {}
    }
    return NextResponse.json({
      usedToday,
      limit: FREE_GUEST_LIMIT,
      remaining: Math.max(0, FREE_GUEST_LIMIT - usedToday),
      isGuest: true,
      plan: "guest",
      credits: 0,
    });
  }

  // 登录用户：从 D1 读取
  try {
    const dbUser = await getUserByGoogleId(user.id);
    if (dbUser) {
      const usageInfo = await getUsageLimit(dbUser);
      const usedToday = await getDailyUsage(dbUser.id);
      return NextResponse.json({
        usedToday,
        limit: usageInfo.totalLimit,
        remaining: Math.max(0, usageInfo.totalLimit - usedToday),
        isGuest: false,
        plan: usageInfo.plan,
        credits: dbUser.credits || 0,
        subscriptionExpires: dbUser.subscription_expires || null,
      });
    }
  } catch (dbErr) {
    console.error("D1 query error:", dbErr);
  }

  // D1 查询失败的降级处理
  return NextResponse.json({
    usedToday: 0,
    limit: FREE_USER_LIMIT,
    remaining: FREE_USER_LIMIT,
    isGuest: false,
    plan: user.plan || "free",
    credits: 0,
  });
}
