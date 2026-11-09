import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Mali } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const mali = Mali({
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-mali", // เพิ่ม variable เผื่อใช้เรียกผ่าน Tailwind ได้ด้วยครับ
});

export const metadata: Metadata = {
  title: "Secret Stroke",
  description: "Draw, Guess, Find the Impostor!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col ${mali.className}`}>{children}</body>
    </html>
  );
}