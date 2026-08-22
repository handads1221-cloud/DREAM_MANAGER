import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "드림 어린이부 | 청주신흥교회",
  description: "청주신흥교회 드림 어린이부의 출석, 드림보석, 공지와 가족 소식을 한곳에서 관리합니다.",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
