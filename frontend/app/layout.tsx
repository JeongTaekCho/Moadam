import type { Metadata } from "next";
import {
  siteUrl,
  siteName,
  siteTitle,
  siteDescription,
  searchIndexable,
} from "@/shared/config/site";
import "./globals.css";
import localFont from "next/font/local";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: `%s | ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  robots: { index: searchIndexable, follow: searchIndexable },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "모아담 — 모임의 이야기와 자료, 일정을 한곳에",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image"],
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NAVER_SITE_VERIFICATION
      ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION }
      : undefined,
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={pretendard.variable}>{children}</body>
    </html>
  );
}
