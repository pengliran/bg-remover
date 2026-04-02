"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PaymentResult() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("正在确认支付...");

  useEffect(() => {
    const token = searchParams.get("token");
    const orderId = searchParams.get("order_id");
    const payerId = searchParams.get("PayerID");

    if (!token) {
      setStatus("error");
      setMessage("支付信息缺失");
      return;
    }

    // 调用后端捕获支付
    fetch("/api/paypal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.error || "支付失败");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("网络错误，请重试");
      });
  }, [searchParams]);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto">
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
          {status === "processing" && (
            <>
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-2xl font-bold">确认支付中</h2>
              <p className="text-muted-foreground">请稍候，正在验证支付结果...</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold">支付成功！</h2>
              <p className="text-muted-foreground">{message}</p>
              <a
                href="/"
                className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                开始使用
              </a>
            </>
          )}
          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold">支付失败</h2>
              <p className="text-muted-foreground">{message}</p>
              <div className="flex gap-3 justify-center">
                <a href="/pricing" className="border border-border px-6 py-2.5 rounded-lg font-medium hover:bg-muted transition-colors">
                  重试
                </a>
                <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2.5">
                  返回首页
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>}>
      <PaymentResult />
    </Suspense>
  );
}
