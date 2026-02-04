import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { InstallAppButton } from "@/components/InstallAppButton";
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
  icons: { icon: "/logo.png", apple: "/logo.png" },
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
        <header className="shrink-0 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <Link href="/" className="flex items-center justify-center gap-2 py-3 px-4">
            <Image
              src="/logo.png"
              alt="לוגו האתר"
              width={48}
              height={48}
              className="rounded-full object-cover h-12 w-12"
            />
            <span className="font-semibold text-slate-800">ניהול הוצאות טיול</span>
          </Link>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="text-center text-gray-500 text-sm py-3 px-2 border-t border-gray-100 flex flex-col items-center gap-2">
          <InstallAppButton />
          <span>ניבנה ע&quot;י אלי לבין</span>
        </footer>
      </body>
    </html>
  );
}
