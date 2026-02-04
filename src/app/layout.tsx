import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ניהול הוצאות טיול",
  description: "ניהול הוצאות משותפות בטיול קבוצתי",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "הוצאות טיול" },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen touch-manipulation flex flex-col`}
      >
        <main className="flex-1">{children}</main>
        <footer className="text-center text-gray-500 text-sm py-3 px-2 border-t border-gray-100">
          ניבנה ע&quot;י אלי לבין
        </footer>
      </body>
    </html>
  );
}
