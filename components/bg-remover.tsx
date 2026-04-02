"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ImageUploader } from "./image-uploader";

type Status = "idle" | "processing" | "done" | "error";

interface UserInfo {
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

export function BgRemover() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fileName, setFileName] = useState("");
  const [user, setUser] = useState<UserInfo | null>(null);
  const fileRef = useRef<File | null>(null);

  // 加载历史
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // 检查登录状态
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

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

    setStatus("processing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/remove-bg", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultBlob(blob);
      setStatus("done");

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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStatus("error");
    }
  }, []);

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

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <div className="space-y-8">
      {/* 用户信息栏 */}
      <div className="flex items-center justify-end gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full"
            />
            <span className="text-sm font-medium">{user.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-red-500 transition-colors"
            >
              退出
            </button>
          </div>
        ) : (
          <button
            onClick={() => (window.location.href = "/api/auth")}
            className="flex items-center gap-2 bg-white border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>

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
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
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

      {/* 历史记录 */}
      {history.length > 0 && (
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
    </div>
  );
}
