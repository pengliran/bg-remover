"use client";

import { useState, useCallback, useRef } from "react";

type BatchItemStatus = "pending" | "processing" | "done" | "error";

export interface BatchItem {
  id: string;
  file: File;
  status: BatchItemStatus;
  originalUrl?: string;
  resultUrl?: string;
  resultBlob?: Blob;
  error?: string;
}

interface ProcessResult {
  blob: Blob;
  remaining: number;
  limit: number;
  used: number;
}

export function useBatchProcessor() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const abortRef = useRef(false);

  const MAX_CONCURRENT = 3;

  // 添加文件到队列
  const addFiles = useCallback((files: File[]) => {
    const newItems: BatchItem[] = files.map((file) => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      file,
      status: "pending",
      originalUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...newItems]);
    return newItems.map((i) => i.id);
  }, []);

  // 移除单个文件
  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.originalUrl) URL.revokeObjectURL(item.originalUrl);
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // 清空所有
  const clearAll = useCallback(() => {
    abortRef.current = true;
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
      return [];
    });
    setIsProcessing(false);
    setCompletedCount(0);
  }, []);

  // 批量处理所有待处理的图片
  const processAll = useCallback(async (
    onProgress?: (done: number, total: number) => void
  ): Promise<{ success: number; failed: number }> => {
    setIsProcessing(true);
    abortRef.current = false;

    const pending = items.filter((i) => i.status === "pending");
    let success = 0;
    let failed = 0;

    // 并发控制：分批处理
    for (let i = 0; i < pending.length; i += MAX_CONCURRENT) {
      if (abortRef.current) break;

      const batch = pending.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          // 更新状态为处理中
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: "processing" } : i))
          );

          try {
            const formData = new FormData();
            formData.append("image", item.file);

            const res = await fetch("/api/remove-bg", {
              method: "POST",
              body: formData,
            });

            if (res.status === 429) {
              const data = await res.json().catch(() => ({}));
              throw new Error(`额度用完（${data.usedToday}/${data.limit}）`);
            }

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || `请求失败: ${res.status}`);
            }

            const blob = await res.blob();
            const remaining = parseInt(res.headers.get("X-Usage-Remaining") || "0");
            const used = parseInt(res.headers.get("X-Usage-Used") || "0");
            const limit = parseInt(res.headers.get("X-Usage-Limit") || "0");

            const resultUrl = URL.createObjectURL(blob);

            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, status: "done", resultUrl, resultBlob: blob }
                  : i
              )
            );

            return { success: true, remaining, used, limit, blob } as ProcessResult;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "处理失败";
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, status: "error", error: msg } : i
              )
            );
            throw err;
          }
        })
      );

      // 统计结果
      for (const r of results) {
        if (r.status === "fulfilled") {
          success++;
        } else {
          failed++;
        }
        setCompletedCount((c) => c + 1);
        onProgress?.(success + failed, pending.length);
      }

      // 额度用完时停止
      const has429 = results.some(
        (r) => r.status === "rejected" && r.reason?.message?.includes("额度")
      );
      if (has429) break;
    }

    setIsProcessing(false);
    return { success, failed };
  }, [items]);

  // 重试失败的项目
  const retryFailed = useCallback(() => {
    setItems((prev) =>
      prev.map((i) =>
        i.status === "error" ? { ...i, status: "pending", error: undefined } : i
      )
    );
  }, []);

  return {
    items,
    isProcessing,
    completedCount,
    totalCount: items.length,
    addFiles,
    removeItem,
    clearAll,
    processAll,
    retryFailed,
    hasPending: items.some((i) => i.status === "pending"),
    hasError: items.some((i) => i.status === "error"),
    allDone: items.length > 0 && items.every((i) => i.status === "done" || i.status === "error"),
  };
}
