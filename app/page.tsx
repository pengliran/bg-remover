import { BgRemover } from "@/components/bg-remover";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold">BG Remover</h1>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center pt-12 pb-8 px-6">
        <h2 className="text-4xl font-bold tracking-tight mb-3">
          Remove Image Background
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Upload any image and get a clean transparent background in seconds.
          Powered by AI — no signup, no watermark.
        </p>
      </section>

      {/* Main Tool */}
      <section className="flex-1 px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <BgRemover />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        <p>
          Free online background remover tool. Your images are processed in
          memory and never stored.
        </p>
      </footer>
    </main>
  );
}
