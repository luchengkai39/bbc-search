import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bigboom",
  description: "Search The Big Bang Theory quotes in English and Chinese",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
