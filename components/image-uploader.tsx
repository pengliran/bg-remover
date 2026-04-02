"use client";

import { useCallback, useRef, useState } from "react";

interface ImageUploaderProps {
  onFileSelect: (file: File) => void;
}

/** 支持的图片格式 */
const ACCEPT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
/** 最大文件大小 10MB */
const MAX_SIZE = 10 * 1024 * 1024;

export function ImageUploader({ onFileSelect }: ImageUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPT_TYPES.includes(file.type)) {
      return "Please upload a PNG, JPEG, or WebP image.";
    }
    if (file.size > MAX_SIZE) {
      return "Image must be under 10MB.";
    }
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError("");
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-3">
      {/* 拖拽区域 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <svg
              className="w-6 h-6 text-muted-foreground"
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
            <p className="font-medium">
              Drop your image here, or{" "}
              <span className="text-primary">browse</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PNG, JPEG, WebP — up to 10MB
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
