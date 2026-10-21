import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "웹툰 찐팬 배지 이미지 만들기",
  description: "네이버웹툰 찐팬 배지 목록을 한 장의 이미지로 만들어 저장하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
