"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ImageUploader } from "./image-uploader";
import JSZip from "jszip";

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
  resultDataUrl: string; // full-size result for download
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

// ─── Batch types ───────────────────────────────────────────────────────────

type BatchStatus = "pending" | "processing" | "done" | "error";

interface BatchItem {
  id: string;
  file: File;
  originalUrl: string;
  resultUrl: string | null;
  resultBlob: Blob | null;
  status: BatchStatus;
  error: string;
}

type BatchMode = "single" | "batch";

// ─── Thumbnail helper ───────────────────────────────────────────────────────

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

// ─── History helpers ───────────────────────────────────────────────────────

const HISTORY_KEY = "bg-remover-history";
const MAX_HISTORY = 20;

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw).map((item: Record<string, unknown>) => ({
      ...item,
      resultDataUrl: item.resultDataUrl || "",
    })) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

// ─── useUser hook ───────────────────────────────────────────────────────────

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

// ─── BatchUploader component ───────────────────────────────────────────────

const ACCEPT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
const MAX_SIZE = 10 * 1024 * 1024;

function BatchUploader({
  usage,
  onComplete,
  user,
  onHistoryAdd,
}: {
  usage: UsageInfo | null;
  onComplete: () => void;
  user: UserInfo | null;
  onHistoryAdd?: (item: HistoryItem) => void;
}) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        URL.revokeObjectURL(item.originalUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCount = items.length;
  const completedCount = items.filter(
    (i) => i.status === "done" || i.status === "error"
  ).length;
  const successCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "error").length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const validate = (file: File): string | null => {
    if (!ACCEPT_TYPES.includes(file.type)) {
      return "Please upload PNG, JPEG, or WebP.";
    }
    if (file.size > MAX_SIZE) {
      return "Image must be under 10MB.";
    }
    return null;
  };

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: BatchItem[] = [];
      for (const file of Array.from(files)) {
        const err = validate(file);
        if (err) continue;
        newItems.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          file,
          originalUrl: URL.createObjectURL(file),
          resultUrl: null,
          resultBlob: null,
          status: "pending",
          error: "",
        });
      }
      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.originalUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        URL.revokeObjectURL(item.originalUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
      return [];
    });
  }, []);

  // Process a single item
  const processItem = useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "processing" as BatchStatus, error: "" } : i))
      );

      try {
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const formData = new FormData();
        formData.append("image", item.file);

        const res = await fetch("/api/remove-bg", {
          method: "POST",
          body: formData,
        });

        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          setItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: "error" as BatchStatus,
                    error:
                      data.isGuest
                        ? `额度用完（${data.usedToday}/${data.limit}次）`
                        : `今日额度已用完（${data.usedToday}/${data.limit}次）`,
                  }
                : i
            )
          );
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed: ${res.status}`);
        }

        const blob = await res.blob();
        const resultUrl = URL.createObjectURL(blob);

        setItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? { ...i, status: "done" as BatchStatus, resultUrl, resultBlob: blob }
              : i
          )
        );

        // 保存历史记录（仅登录用户）
        if (user && onHistoryAdd && item) {
          try {
            const [origThumb, resThumb] = await Promise.all([
              createThumbnail(item.file),
              createThumbnail(blob),
            ]);
            const resultDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            onHistoryAdd({
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              originalThumb: origThumb,
              resultThumb: resThumb,
              resultDataUrl,
              timestamp: Date.now(),
              fileName: item.file.name,
            });
          } catch {
            // 缩略图生成失败不影响主流程
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setItems((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, status: "error" as BatchStatus, error: message } : i
          )
        );
      }
    },
    [items]
  );

  // Start batch processing
  const startProcessing = useCallback(async () => {
    if (!usage || usage.remaining <= 0) return;

    const pendingItems = items.filter((i) => i.status === "pending");
    for (const item of pendingItems) {
      await processItem(item.id);
    }
  }, [items, usage, processItem]);

  // Auto-start when items are added (only if we have enough usage)
  useEffect(() => {
    if (items.length === 0) return;
    const hasPending = items.some((i) => i.status === "pending");
    if (hasPending && usage && usage.remaining > 0) {
      startProcessing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Download single file
  const downloadItem = useCallback((item: BatchItem) => {
    if (!item.resultBlob) return;
    const reader = new FileReader();
    reader.onload = () => {
      const a = document.createElement("a");
      a.href = reader.result as string;
      a.download = item.file.name.replace(/\.[^.]+$/, "") + "-no-bg.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    reader.readAsDataURL(item.resultBlob);
  }, []);

  // Download all as ZIP
  const downloadAllZip = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === "done" && i.resultBlob);
    if (doneItems.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("bg-removed");

    await Promise.all(
      doneItems.map(async (item) => {
        const baseName = item.file.name.replace(/\.[^.]+$/, "");
        const blob = item.resultBlob!;
        const arrayBuffer = await blob.arrayBuffer();
        folder!.file(`${baseName}-no-bg.png`, arrayBuffer);
      })
    );

    const content = await zip.generateAsync({ type: "blob" });
    const reader = new FileReader();
    reader.onload = () => {
      const a = document.createElement("a");
      a.href = reader.result as string;
      a.download = `bg-removed-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    reader.readAsDataURL(content);
  }, [items]);

  // Status badge
  const StatusBadge = ({ status, error }: { status: BatchStatus; error: string }) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            ⏳ 等待中
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
            <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            处理中
          </span>
        );
      case "done":
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">
            ✅ 完成
          </span>
        );
      case "error":
        return (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600"
            title={error}
          >
            ❌ 失败: {error}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}
        `}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <svg
              className="w-5 h-5 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm">
              拖拽多张图片到这里，或{" "}
              <span className="text-primary">点击选择</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PNG, JPEG, WebP — 每张最大 10MB
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_TYPES.join(",")}
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Usage warning */}
      {usage && items.length > usage.remaining && items.some((i) => i.status === "pending") && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 text-sm text-yellow-700">
          ⚠️ 已选择 {items.length} 张图片，但您当前剩余 {usage.remaining} 次额度，超出的图片将处理失败。建议分批上传。
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <>
          {/* Overall progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                总体进度 ({completedCount}/{totalCount})
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>✅ 成功: {successCount}</span>
              <span>❌ 失败: {failedCount}</span>
              <span>⏳ 等待: {items.filter((i) => i.status === "pending").length}</span>
            </div>
          </div>

          {/* File items grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border overflow-hidden bg-muted/30 hover:shadow-sm transition-shadow"
              >
                {/* Thumbnails */}
                <div className="flex h-28">
                  <div className="flex-1 relative bg-muted">
                    <img
                      src={item.originalUrl}
                      alt="Original"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0.5 left-0.5 text-[9px] bg-black/50 text-white px-1 rounded">
                      原图
                    </span>
                  </div>
                  <div className="flex-1 checkerboard relative">
                    {item.resultUrl ? (
                      <img
                        src={item.resultUrl}
                        alt="Result"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {item.status === "processing" && (
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                        {item.status === "pending" && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        {item.status === "error" && (
                          <span className="text-red-500 text-xs px-1">失败</span>
                        )}
                      </div>
                    )}
                    <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/50 text-white px-1 rounded">
                      结果
                    </span>
                  </div>
                </div>

                {/* Info row */}
                <div className="px-2 py-1.5 space-y-1">
                  <p className="text-xs truncate font-medium" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={item.status} error={item.error} />
                    <div className="flex gap-1">
                      {item.status === "done" && (
                        <button
                          onClick={() => downloadItem(item)}
                          className="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                          title="下载"
                        >
                          ⬇️
                        </button>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs px-1.5 py-0.5 bg-red-50 text-red-400 rounded hover:bg-red-100 transition-colors"
                        title="移除"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            {successCount > 0 && (
              <button
                onClick={downloadAllZip}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                ⬇️ 下载全部 ZIP ({successCount} 张)
              </button>
            )}
            {items.some((i) => i.status === "pending") && (
              <button
                onClick={startProcessing}
                disabled={!usage || usage.remaining <= 0}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🪄 开始处理
              </button>
            )}
            <button
              onClick={clearAll}
              className="bg-muted text-foreground px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors"
            >
              清空列表
            </button>
            <button
              onClick={onComplete}
              className="bg-muted text-foreground px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors"
            >
              返回单张模式
            </button>
          </div>
        </>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          选择多张图片开始批量处理 ✨
        </div>
      )}
    </div>
  );
}

// ─── BgRemover ─────────────────────────────────────────────────────────────

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
  const [mode, setMode] = useState<BatchMode>("single");
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

        const resultDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const newItem: HistoryItem = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          originalThumb: origThumb,
          resultThumb: resThumb,
          resultDataUrl,
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

  const handleBatchComplete = useCallback(() => {
    setMode("single");
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

      {/* Tab 切换：单张 / 批量 */}
      {!originalUrl && (
        <div className="flex border-b border-border">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "single"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🖼️ 单张处理
          </button>
          <button
            onClick={() => setMode("batch")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "batch"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📦 批量处理
          </button>
        </div>
      )}

      {/* 单张模式 */}
      {mode === "single" && !originalUrl && <ImageUploader onFileSelect={handleFileSelect} />}

      {/* 批量模式 */}
      {mode === "batch" && !originalUrl && (
        <BatchUploader
          usage={usage}
          onComplete={handleBatchComplete}
          user={user}
          onHistoryAdd={(newItem) => {
            setHistory((prev) => {
              const updated = [newItem, ...prev].slice(0, MAX_HISTORY);
              saveHistory(updated);
              return updated;
            });
          }}
        />
      )}

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
                Pay-as-you-go：$0.05/张，按需购买积分包 ·{" "}
                <a href="/pricing" className="text-primary hover:underline">
                  查看完整定价
                </a>
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
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground truncate">
                      {item.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {item.resultDataUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const a = document.createElement("a");
                        a.href = item.resultDataUrl;
                        a.download = item.fileName.replace(/\.[^.]+$/, "") + "-no-bg.png";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="ml-2 w-6 h-6 flex items-center justify-center rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                      title="Download"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  )}
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