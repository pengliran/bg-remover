"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ImageUploader } from "./image-uploader";

type Status = "idle" | "processing" | "done" | "error";

interface HistoryItem {
  id: string;
  /** 原图缩略图 base64（小尺寸节省空间） */
  originalThumb: string;
  /** 结果缩略图 base64 */
  resultThumb: string;
  /** 处理时间 */
  timestamp: number;
  /** 原始文件名 */
  fileName: string;
}

const HISTORY_KEY = "bg-remover-history";
const MAX_HISTORY = 20;
/** 缩略图最大宽度 */
const THUMB_MAX_W = 120;

/** 把图片 blob 缩放成缩略图 base64 */
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

/** 从 localStorage 读取历史 */
function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 写入 localStorage */
function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export function BgRemover() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<File | null>(null);

  // 初始化历史
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // 处理上传
  const handleFileSelect = useCallback((file: File) => {
    fileRef.current = file;
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setOriginalBlob(file);
    setResultUrl(null);
    setResultBlob(null);
    setStatus("idle");
    setError("");
    setFileName(file.name);
  }, []);

  // 去背景
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

      // 生成缩略图并写入历史
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

  // 下载结果 — 通过 FileReader 转 base64 Data URI，浏览器必定下载
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

  // 重置
  const handleReset = useCallback(() => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    fileRef.current = null;
    setOriginalUrl(null);
    setOriginalBlob(null);
    setResultUrl(null);
    setResultBlob(null);
    setStatus("idle");
    setError("");
    setFileName("");
  }, []);

  // 删除历史条目
  const handleDeleteHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  // 清空历史
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  return (
    <div className="space-y-8">
      {/* 上传区域 */}
      {!originalUrl && <ImageUploader onFileSelect={handleFileSelect} />}

      {/* 处理结果 */}
      {originalUrl && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 原图 */}
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

            {/* 结果 */}
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

          {/* 操作按钮 */}
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
                {/* 缩略图对比 */}
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

                {/* 文件名 + 时间 */}
                <div className="px-2 py-1.5">
                  <p className="text-xs text-foreground truncate">
                    {item.fileName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>

                {/* 删除按钮 */}
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
