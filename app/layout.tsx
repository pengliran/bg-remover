import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Background Remover - Free AI Background Removal Tool",
  description:
    "Remove image backgrounds instantly with AI. Upload any photo and get a transparent PNG in seconds. Free online background remover tool — no signup required.",
  keywords: [
    "background remover",
    "remove background",
    "background removal",
    "transparent background",
    "AI background remover",
    "free background remover",
    "online image editor",
    "remove.bg alternative",
    "抠图工具",
    "去背景",
  ],
  openGraph: {
    title: "Image Background Remover - Free AI Tool",
    description:
      "Remove backgrounds from images instantly. Get transparent PNGs in seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
