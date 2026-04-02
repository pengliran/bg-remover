"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ImageUploader } from "./image-uploader";

type Status = "idle" | "processing" | "done" | "error";

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

interface HistoryItem {
  id: string;
  originalThumb: string;
  resultThumb: string;
  timestamp: number;
  fileName: string;
}

interface UsageInfo {
  usedToday: number;
  limit: number;
  remaining: number;
  isGuest: boolean;
  plan: string;
}

const HISTORY_KEY = "bg-remover-history";
const MAX_HISTORY = 20;
const THUMB_MAX_W = 120;

function createThumbnail(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, THUMB_MAX_W / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png", 0.6));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, setUser, logout };
}

export function BgRemover({ user }: { user: UserInfo | null }) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fileName, setFileName] = useState("");
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const fileRef = useRef<File | null>(null);

  // 加载历史（仅登录用户）
  useEffect(() => {
    if (user) {
      setHistory(loadHistory());
    } else {
      setHistory([]);
    }
  }, [user]);

  // 加载用量信息
  const fetchUsage = useCallback(() => {
    fetch("/api/remove-bg")
      .then((res) => res.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const handleFileSelect = useCallback((file: File) => {
    fileRef.current = file;
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setResultUrl(null);
    setResultBlob(null);
    setStatus("idle");
    setError("");
    setFileName(file.name);
  }, []);

  const handleRemoveBg = useCallback(async () => {
    const file = fileRef.current;
    if (!file) return;

    // 检查用量
    if (usage && usage.remaining <= 0) {
      setShowUpgrade(true);
      return;
    }

    setStatus("processing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/remove-bg", {
        method: "POST",
        body: formData,
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(
          data.isGuest
            ? `免费额度已用完（${data.usedToday}/${data.limit}次）。登录后每月可使用 10 次免费额度。`
            : `今日额度已用完（${data.usedToday}/${data.limit}次）。升级套餐获取更多次数。`
        );
        setShowUpgrade(true);
        setStatus("error");
        setUsage(data);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      // 更新用量
      const remaining = parseInt(res.headers.get("X-Usage-Remaining") || "0");
      const used = parseInt(res.headers.get("X-Usage-Used") || "0");
      const limit = parseInt(res.headers.get("X-Usage-Limit") || "0");
      setUsage((prev) =>
        prev
          ? { ...prev, remaining, usedToday: used, limit }
          : { usedToday: used, limit, remaining, isGuest: !user, plan: user ? "free" : "guest" }
      );

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultBlob(blob);
      setStatus("done");

      // 保存历史（仅登录用户）
      if (user) {
        const [origThumb, resThumb] = await Promise.all([
          createThumbnail(file),
          createThumbnail(blob),
        ]);

        const newItem: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          originalThumb: origThumb,
          resultThumb: resThumb,
          timestamp: Date.now(),
          fileName: file.name,
        };

        setHistory((prev) => {
          const updated = [newItem, ...prev].slice(0, MAX_HISTORY);
          saveHistory(updated);
          return updated;
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStatus("error");
    }
  }, [fileRef, usage, user, fetchUsage]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    const reader = new FileReader();
    reader.onload = () => {
      const a = document.createElement("a");
      a.href = reader.result as string;
      a.download = fileName.replace(/\.[^.]+$/, "") + "-no-bg.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    reader.readAsDataURL(resultBlob);
  }, [resultBlob, fileName]);

  const handleReset = useCallback(() => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    fileRef.current = null;
    setOriginalUrl(null);
    setResultBlob(null);
    setResultUrl(null);
    setStatus("idle");
    setError("");
    setFileName("");
  }, [originalUrl, resultUrl]);

  const handleDeleteHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  return (
    <div className="space-y-8">
      {/* 用量提示条 */}
      {usage && (
        <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">今日已用:</span>
            <span className="font-medium">
              {usage.usedToday} / {usage.limit === Infinity ? "∞" : usage.limit}
            </span>
          </div>
          {!user && (
            <button
              onClick={() => (window.location.href = "/api/auth")}
              className="text-primary hover:underline text-sm"
            >
              登录获取更多次数 →
            </button>
          )}
          {user && usage.plan === "free" && usage.remaining <= 3 && usage.remaining > 0 && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="text-primary hover:underline text-sm"
            >
              次数不足，升级套餐 →
            </button>
          )}
        </div>
      )}

      {/* 上传区域 */}
      {!originalUrl && <ImageUploader onFileSelect={handleFileSelect} />}

      {/* 处理结果 */}
      {originalUrl && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Original
              </h3>
              <div className="rounded-lg border border-border overflow-hidden bg-muted">
                <img
                  src={originalUrl}
                  alt="Original"
                  className="w-full h-auto max-h-[500px] object-contain"
                />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Result
              </h3>
              <div className="rounded-lg border border-border overflow-hidden checkerboard min-h-[200px] flex items-center justify-center">
                {status === "processing" && (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Removing background...</p>
                  </div>
                )}
                {status === "done" && resultUrl && (
                  <img
                    src={resultUrl}
                    alt="Result"
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                )}
                {status === "error" && (
                  <div className="text-center p-6 text-red-500">
                    <p className="text-sm">{error}</p>
                  </div>
                )}
                {status === "idle" && (
                  <p className="text-sm text-muted-foreground p-6">
                    Click &quot;Remove Background&quot; to process
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            {status === "idle" && (
              <button
                onClick={handleRemoveBg}
                disabled={usage ? usage.remaining <= 0 : false}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🪄 Remove Background
              </button>
            )}
            {status === "done" && (
              <button
                onClick={handleDownload}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                ⬇️ Download PNG
              </button>
            )}
            <button
              onClick={handleReset}
              className="bg-muted text-foreground px-6 py-3 rounded-lg font-medium hover:bg-muted/80 transition-colors"
            >
              {status === "done" ? "✨ New Image" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* 升级弹窗 */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-xl font-bold">升级套餐</h3>
            <p className="text-muted-foreground text-sm">
              {usage?.isGuest
                ? "登录即可获得每月 10 次免费额度，或选择以下套餐获取更多次数。"
                : "免费额度已用完，升级套餐继续使用。"}
            </p>

            <div className="grid gap-3">
              {/* 游客/登录提示 */}
              {!user && (
                <button
                  onClick={() => {
                    setShowUpgrade(false);
                    window.location.href = "/api/auth";
                  }}
                  className="border-2 border-primary rounded-lg p-4 text-left hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">免费登录</div>
                      <div className="text-sm text-muted-foreground">
                        每月 10 次
                      </div>
                    </div>
                    <span className="text-primary font-bold">$0</span>
                  </div>
                </button>
              )}

              {[
                { name: "Basic", price: "$1.99", count: "100 次/月" },
                { name: "Pro", price: "$8.99", count: "500 次/月", popular: true },
                { name: "Unlimited", price: "$19.99", count: "不限次" },
              ].map((plan) => (
                <button
                  key={plan.name}
                  onClick={() => setShowUpgrade(false)}
                  className={`rounded-lg p-4 text-left hover:bg-gray-50 transition-colors ${
                    plan.popular
                      ? "border-2 border-primary bg-primary/5"
                      : "border border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{plan.name}</span>
                        {plan.popular && (
                          <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                            推荐
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {plan.count}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-lg">{plan.price}</span>
                      <div className="text-xs text-muted-foreground">/月</div>
                    </div>
                  </div>
                </button>
              ))}

              <p className="text-xs text-muted-foreground text-center">
                Pay-as-you-go：$0.05/张，按需购买积分包
              </p>
            </div>

            <button
              onClick={() => setShowUpgrade(false)}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 历史记录 — 仅登录用户可见 */}
      {user && history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              📋 History ({history.length})
            </h3>
            <button
              onClick={handleClearHistory}
              className="text-sm text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-lg border border-border overflow-hidden bg-muted hover:shadow-md transition-shadow"
              >
                <div className="flex">
                  <div className="flex-1 relative">
                    <img
                      src={item.originalThumb}
                      alt="Original"
                      className="w-full h-auto"
                    />
                    <span className="absolute bottom-0 left-0 text-[10px] bg-black/50 text-white px-1 rounded-tr">
                      Before
                    </span>
                  </div>
                  <div className="flex-1 checkerboard relative">
                    <img
                      src={item.resultThumb}
                      alt="Result"
                      className="w-full h-auto"
                    />
                    <span className="absolute bottom-0 right-0 text-[10px] bg-black/50 text-white px-1 rounded-tl">
                      After
                    </span>
                  </div>
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-xs text-foreground truncate">
                    {item.fileName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteHistory(item.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 未登录提示 — 替代历史记录区域 */}
      {user && history.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">还没有处理记录，上传图片开始使用吧 ✨</p>
        </div>
      )}
    </div>
  );
}
