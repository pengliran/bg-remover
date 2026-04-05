import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const PAYPAL_BASE_URL = "https://api-m.paypal.com";
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "5E608866RF9911413";

// 积分包配置
const CREDIT_PACKS: Record<string, number> = {
  pack_20: 20,
  pack_100: 100,
  pack_500: 500,
  pack_1000: 1000,
};

// 包月套餐用量配置
const SUBSCRIPTION_LIMITS: Record<string, number> = {
  basic: 100,
  pro: 500,
  unlimited: Infinity,
};

// 验证 Webhook 签名
async function verifyWebhookSignature(headers: Headers, body: string): Promise<boolean> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return false;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const verifyBody = JSON.stringify({
    auth_algo: headers.get("paypal-auth-algo") || "",
    cert_url: headers.get("paypal-cert-url") || "",
    transmission_id: headers.get("paypal-transmission-id") || "",
    transmission_sig: headers.get("paypal-transmission-sig") || "",
    transmission_time: headers.get("paypal-transmission-time") || "",
    webhook_id: WEBHOOK_ID,
    webhook_event: JSON.parse(body),
  });

  try {
    const res = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: verifyBody,
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

// POST /api/paypal/webhook — 接收 PayPal Webhook 通知
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    // 1. 验证 Webhook 签名
    const isValid = await verifyWebhookSignature(request.headers, body);
    if (!isValid) {
      console.error("Webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const eventType = event.event_type;
    console.log(`PayPal webhook received: ${eventType}`);

    // 2. 处理不同事件
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      // 支付成功
      const resource = event.resource;
      const customId = resource.custom_id || "";
      const [planType, planId] = customId.split(":");

      console.log(`Payment captured: ${planType}:${planId}, amount: ${resource.amount?.value}`);

      // TODO: 后续迁移到 D1 时，在这里写入数据库
      // 当前方案通过前端 /payment 页面 capture 时已经更新了 cookie
      // Webhook 作为兜底验证，日志记录即可

      return NextResponse.json({ received: true, event_type: eventType });
    }

    if (eventType === "PAYMENT.CAPTURE.DENIED") {
      console.log(`Payment denied: ${event.resource?.id}`);
      return NextResponse.json({ received: true, event_type: eventType });
    }

    if (eventType === "PAYMENT.CAPTURE.REVERSED") {
      // 退款
      const resource = event.resource;
      const customId = resource.custom_id || "";
      const [planType, planId] = customId.split(":");

      console.log(`Payment reversed (refund): ${planType}:${planId}`);

      // TODO: 退款时需要扣减用户权益

      return NextResponse.json({ received: true, event_type: eventType });
    }

    // 其他事件暂不处理
    return NextResponse.json({ received: true, event_type: eventType });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// GET /api/paypal/webhook — 健康检查（PayPal 验证端点可用）
export async function GET() {
  return NextResponse.json({ status: "ok", webhook_id: WEBHOOK_ID });
}
