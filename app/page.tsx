"use client";

import { useUser, type UserInfo } from "@/components/bg-remover";
import { usePathname } from "next/navigation";

function UserBar() {
  const { user, logout } = useUser();

  if (user) {
    return (
      <div className="flex items-center gap-1">
        <a
          href="/pricing"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
        >
          定价
        </a>
        <a
          href="/account"
          className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5 transition-colors"
        >
          <img
            src={user.avatar}
            alt={user.name}
            className="w-7 h-7 rounded-full"
            referrerPolicy="no-referrer"
          />
          <span className="text-sm font-medium hidden sm:inline max-w-[120px] truncate">
            {user.name}
          </span>
        </a>
        <button
          onClick={logout}
          className="text-sm text-muted-foreground hover:text-red-500 transition-colors px-2"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <a
        href="/pricing"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
      >
        定价
      </a>
      <button
        onClick={() => (window.location.href = "/api/auth")}
        className="flex items-center gap-2 bg-white border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}

export default function Home() {
  const { user } = useUser();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold">BG Remover</h1>
            </a>
          </div>
          <UserBar />
        </div>
      </header>

      {/* Hero */}
      <section className="text-center pt-12 pb-8 px-6">
        <h2 className="text-4xl font-bold tracking-tight mb-3">
          Remove Image Background
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Upload any image and get a clean transparent background in seconds.
          Powered by AI — no watermark.
        </p>
      </section>

      {/* Main Tool */}
      <section className="flex-1 px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <BgRemover user={user} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <a href="/pricing" className="hover:text-foreground transition-colors">定价</a>
          <span>·</span>
          <span>© 2026 BG Remover</span>
        </div>
      </footer>
    </main>
  );
}

// Need to import BgRemover
import { BgRemover } from "@/components/bg-remover";
