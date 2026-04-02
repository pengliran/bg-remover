"use client";

import { useUser } from "@/components/bg-remover";
import { useState, useEffect, useCallback } from "react";

interface UsageInfo {
  usedToday: number;
  limit: number;
  remaining: number;
  isGuest: boolean;
  plan: string;
}

export default function AccountPage() {
  const { user, logout } = useUser();
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  const fetchUsage = useCallback(() => {
    fetch("/api/remove-bg")
      .then((res) => res.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col">
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
          </div>
        </header>

        <section className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-6 max-w-sm">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">请先登录</h2>
            <p className="text-muted-foreground">登录后即可查看个人中心、套餐信息和用量统计。</p>
            <button
              onClick={() => (window.location.href = "/api/auth")}
              className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        </section>
      </main>
    );
  }

  const planName = usage?.plan === "free" ? "Free" : usage?.plan === "basic" ? "Basic ($1.99/月)" : usage?.plan === "pro" ? "Pro ($8.99/月)" : usage?.plan === "unlimited" ? "Unlimited ($19.99/月)" : "Free";

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

      {/* Content */}
      <section className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* 用户信息卡片 */}
          <div className="border border-border rounded-xl p-6">
            <div className="flex items-center gap-4">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-16 h-16 rounded-full"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1">
                <h2 className="text-xl font-bold">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">当前方案</div>
                <div className="font-bold text-primary">{planName}</div>
              </div>
            </div>
          </div>

          {/* 用量统计 */}
          {usage && (
            <div className="border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-bold text-lg">📊 用量统计</h3>

              {/* 今日用量 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>今日已用</span>
                  <span className="font-medium">
                    {usage.usedToday} / {usage.limit === Infinity ? "∞" : usage.limit} 次
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all"
                    style={{
                      width: usage.limit === Infinity
                        ? "0%"
                        : `${Math.min(100, (usage.usedToday / usage.limit) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  今日剩余 {usage.remaining === Infinity ? "∞" : `${usage.remaining}`} 次
                </p>
              </div>

              {/* 快捷操作 */}
              <div className="flex gap-3 pt-2">
                <a
                  href="/pricing"
                  className="flex-1 py-2.5 text-center text-sm font-medium border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors"
                >
                  升级套餐
                </a>
                <a
                  href="/pricing#credits"
                  className="flex-1 py-2.5 text-center text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  购买积分
                </a>
              </div>
            </div>
          )}

          {/* 账户管理 */}
          <div className="border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-lg">⚙️ 账户管理</h3>
            <div className="space-y-3">
              {[
                { label: "修改密码", desc: "管理 Google 账户密码", href: "https://myaccount.google.com/security", external: true },
                { label: "套餐管理", desc: "升级、降级或取消订阅", href: "/pricing" },
                { label: "购买记录", desc: "查看历史订单和消费记录", href: "#", disabled: true },
                { label: "帮助中心", desc: "常见问题和联系客服", href: "#", disabled: true },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.disabled ? undefined : item.href}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    item.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted cursor-pointer"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                  {!item.disabled && (
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* 退出登录 */}
          <button
            onClick={logout}
            className="w-full py-3 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            退出登录
          </button>
        </div>
      </section>
    </main>
  );
}
