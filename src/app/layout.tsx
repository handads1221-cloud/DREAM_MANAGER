import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "드림 어린이부 | 청주신흥교회",
  description: "청주신흥교회 드림 어린이부의 출석, 드림보석, 공지와 가족 소식을 한곳에서 관리합니다.",
  applicationName: "드림 매니저",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "드림 매니저", statusBarStyle: "default" },
  openGraph: {
    title: "드림 어린이부",
    description: "함께 자라고, 함께 꿈꾸는 우리",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "드림 어린이부" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "드림 어린이부",
    description: "함께 자라고, 함께 꿈꾸는 우리",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = { themeColor: "#0b8f78" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
