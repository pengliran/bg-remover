import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/google-auth";
import { getUserByGoogleId, updateUserPlan, addUserCredits } from "@/lib/db";

export const runtime = "edge";

// PayPal API 配置
const PAYPAL_BASE_URL = "https://api-m.paypal.com";

interface PayPalOrderRequest {
  planId: string;
  planType: "subscription" | "credit";
}

interface CreditPack {
  id: string;
  credits: number;
  price: string;
  name: string;
}

// 积分包配置
const CREDIT_PACKS: Record<string, CreditPack> = {
  pack_20: { id: "pack_20", credits: 20, price: "1.00", name: "20 张积分包" },
  pack_100: { id: "pack_100", credits: 100, price: "4.50", name: "100 张积分包" },
  pack_500: { id: "pack_500", credits: 500, price: "20.00", name: "500 张积分包" },
  pack_1000: { id: "pack_1000", credits: 1000, price: "35.00", name: "1000 张积分包" },
};

// 包月套餐配置
const SUBSCRIPTION_PLANS: Record<string, { name: string; price: string }> = {
  basic: { name: "Basic", price: "1.99" },
  pro: { name: "Pro", price: "8.99" },
  unlimited: { name: "Unlimited", price: "19.99" },
};

// 获取 PayPal Access Token
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error("Failed to get PayPal access token");
  const data = await res.json();
  return data.access_token;
}

// 从 cookie 获取用户 Google ID
function getUserGoogleId(request: NextRequest): string | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const userData = JSON.parse(Buffer.from(raw, "base64").toString());
    return userData.id || null;
  } catch {
    return null;
  }
}

// POST /api/paypal — 创建 PayPal 订单
export async function POST(request: NextRequest) {
  try {
    const body: PayPalOrderRequest = await request.json();
    const { planId, planType } = body;

    const accessToken = await getPayPalAccessToken();

    let orderAmount = "0";
    let orderDescription = "";

    if (planType === "credit") {
      const pack = CREDIT_PACKS[planId];
      if (!pack) {
        return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
      }
      orderAmount = pack.price;
      orderDescription = pack.name;
    } else if (planType === "subscription") {
      const plan = SUBSCRIPTION_PLANS[planId];
      if (!plan) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }
      orderAmount = plan.price;
      orderDescription = `${plan.name} 月度订阅`;
    } else {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    // 获取当前域名作为回调地址
    const host = request.headers.get("host") || "bg-remover-c00.pages.dev";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${protocol}://${host}`;

    // 创建 PayPal 订单
    const orderRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: orderAmount,
            },
            description: orderDescription,
            custom_id: `${planType}:${planId}`,
          },
        ],
        application_context: {
          brand_name: "BG Remover",
          return_url: `${baseUrl}/payment`,
          cancel_url: `${baseUrl}/payment?cancelled=true`,
        },
      }),
    });

    if (!orderRes.ok) {
      const error = await orderRes.text();
      console.error("PayPal create order error:", error);
      return NextResponse.json({ error: "Failed to create PayPal order" }, { status: 500 });
    }

    const order = await orderRes.json();

    return NextResponse.json({
      orderId: order.id,
      approvalUrl: order.links.find((l: { rel: string }) => l.rel === "approve")?.href,
    });
  } catch (err) {
    console.error("Create order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

// PUT /api/paypal — 捕获支付并写入 D1
export async function PUT(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const captureRes = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!captureRes.ok) {
      const error = await captureRes.text();
      console.error("PayPal capture error:", error);
      return NextResponse.json({ error: "Failed to capture payment" }, { status: 500 });
    }

    const capture = await captureRes.json();

    if (capture.status !== "COMPLETED") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    // 从 custom_id 获取套餐信息
    const customId = capture.purchase_units[0]?.payments?.captures[0]?.custom_id ||
                     capture.purchase_units[0]?.custom_id || "";

    const [planType, planId] = customId.split(":");
    const amount = capture.purchase_units[0]?.payments?.captures[0]?.amount?.value || "0";

    // ★ 关键：从 D1 更新用户套餐/积分
    const googleId = getUserGoogleId(request);

    if (googleId) {
      const dbUser = await getUserByGoogleId(googleId);
      if (dbUser) {
        if (planType === "subscription") {
          // 包月套餐：设置 30 天后过期
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          await updateUserPlan(dbUser.id, planId, expiresAt.toISOString());
        } else if (planType === "credit") {
          // 积分包：直接加积分
          const pack = CREDIT_PACKS[planId];
          if (pack) {
            await addUserCredits(dbUser.id, pack.credits);
          }
        }
      }
    } else {
      console.warn("Payment captured but no user session found. Google ID missing.");
    }

    // 更新 cookie 中的套餐/积分信息
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
    let userData: Record<string, unknown> = {};

    if (sessionCookie) {
      try {
        userData = JSON.parse(Buffer.from(sessionCookie, "base64").toString());
      } catch {}
    }

    if (planType === "subscription") {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      userData.plan = planId;
      userData.subscriptionExpires = expiresAt.toISOString();
    } else if (planType === "credit") {
      const pack = CREDIT_PACKS[planId];
      userData.credits = (Number(userData.credits) || 0) + (pack?.credits || 0);
    }

    const encoded = Buffer.from(JSON.stringify(userData)).toString("base64");
    const response = NextResponse.json({
      success: true,
      planType,
      planId,
      amount,
      message: planType === "subscription"
        ? `已升级到 ${SUBSCRIPTION_PLANS[planId]?.name || planId} 方案`
        : `已购买 ${CREDIT_PACKS[planId]?.name || planId}`,
    });

    response.cookies.set(SESSION_COOKIE, encoded, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("Capture error:", err);
    return NextResponse.json({ error: "Failed to capture payment" }, { status: 500 });
  }
}
