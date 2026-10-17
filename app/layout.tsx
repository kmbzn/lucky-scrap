import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Lucky Scrap",
  applicationName: "Lucky Scrap",
  appleWebApp: {
    capable: true,
    title: "Lucky Scrap",
    statusBarStyle: "default",
  },
  description: "아이템 수집·조합·물물교환 게임",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3e9",
  viewportFit: "cover",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
