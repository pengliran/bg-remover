"use client";

import { useUser } from "@/components/bg-remover";

interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  count: string;
  features: string[];
  popular?: boolean;
  onSelect?: () => void;
}

function PlanCard({ name, price, period, count, features, popular, onSelect }: PlanCardProps) {
  return (
    <div
      className={`relative rounded-xl p-6 flex flex-col ${
        popular
          ? "border-2 border-primary bg-primary/5 shadow-lg"
          : "border border-border"
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-lg font-bold">{name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{price}</span>
          {period && <span className="text-muted-foreground text-sm">{period}</span>}
        </div>
        <p className="text-muted-foreground text-sm">{count}</p>
      </div>
      <ul className="my-6 space-y-3 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
          popular
            ? "bg-primary text-white hover:bg-primary/90"
            : "border border-border hover:bg-muted"
        }`}
      >
        {onSelect ? "选择方案" : "当前方案"}
      </button>
    </div>
  );
}

function CreditPackCard({ credits, price, perCredit }: { credits: string; price: string; perCredit: string }) {
  return (
    <div className="border border-border rounded-xl p-5 flex flex-col items-center text-center hover:shadow-md transition-shadow">
      <div className="text-2xl font-bold">{credits}</div>
      <div className="text-muted-foreground text-sm mb-3">积分包</div>
      <div className="text-lg font-bold">{price}</div>
      <div className="text-xs text-muted-foreground">{perCredit}/张</div>
      <button className="mt-4 w-full py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
        购买
      </button>
    </div>
  );
}

export default function PricingPage() {
  const { user } = useUser();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold">BG Remover</h1>
          </a>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 返回工具
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center pt-16 pb-12 px-6">
        <h2 className="text-4xl font-bold tracking-tight mb-3">
          选择适合你的方案
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          从免费到专业版，按需选择。所有付费方案均无水印、高画质。
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="flex-1 px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          {/* 包月套餐 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <PlanCard
              name="Basic"
              price="$1.99"
              period="/月"
              count="每月 100 次"
              features={[
                "100 次去背景/月",
                "最高 10MB 图片",
                "透明 PNG 输出",
                "无水印",
              ]}
            />
            <PlanCard
              name="Pro"
              price="$8.99"
              period="/月"
              count="每月 500 次"
              popular
              features={[
                "500 次去背景/月",
                "最高 10MB 图片",
                "透明 PNG 输出",
                "无水印",
                "批量处理（即将推出）",
                "更换背景（即将推出）",
                "优先处理队列",
              ]}
            />
            <PlanCard
              name="Unlimited"
              price="$19.99"
              period="/月"
              count="不限次数"
              features={[
                "不限次去背景",
                "最高 10MB 图片",
                "透明 PNG 输出",
                "无水印",
                "批量处理",
                "更换背景",
                "优先处理队列",
                "API 接口访问",
              ]}
            />
          </div>

          {/* Pay-as-you-go 积分包 */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-center mb-2">按需购买积分包</h3>
            <p className="text-muted-foreground text-center mb-8">
              不想包月？购买积分包，用多少算多少，永久有效。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <CreditPackCard credits="20 张" price="$1" perCredit="$0.05" />
              <CreditPackCard credits="100 张" price="$4.50" perCredit="$0.045" />
              <CreditPackCard credits="500 张" price="$20" perCredit="$0.04" />
              <CreditPackCard credits="1000 张" price="$35" perCredit="$0.035" />
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-6">常见问题</h3>
            <div className="space-y-4">
              {[
                {
                  q: "免费用户和登录用户的区别是什么？",
                  a: "未登录游客每天可免费使用 3 次，登录后每天可使用 10 次。历史记录仅登录用户可用。",
                },
                {
                  q: "积分包和包月套餐可以同时使用吗？",
                  a: "可以。系统会优先消耗包月额度，包月用完后再消耗积分包余额。",
                },
                {
                  q: "积分包有有效期吗？",
                  a: "积分包永久有效，不会过期。",
                },
                {
                  q: "如何升级或取消套餐？",
                  a: "登录后点击右上角头像，进入账户设置即可管理订阅。取消后当前套餐到期自动降级为免费版。",
                },
                {
                  q: "支持哪些支付方式？",
                  a: "支持信用卡（Visa / Mastercard）、PayPal。",
                },
              ].map((item, i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <h4 className="font-medium mb-1">{item.q}</h4>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        <p>All prices in USD. Need help? Contact us at support@srep.top</p>
      </footer>
    </main>
  );
}
