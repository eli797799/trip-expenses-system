import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { InstallAppButton } from "@/components/InstallAppButton";
import { PushSetup } from "@/components/PushSetup";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body
        className={`${plusJakarta.variable} ${geistMono.variable} font-sans antialiased min-h-screen touch-manipulation flex flex-col bg-[var(--background)] text-[var(--foreground)]`}
      >
        <header className="shrink-0 border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <Link href="/" className="flex items-center justify-center gap-2 py-3 px-4 hover:opacity-90 transition-opacity">
            <Image
              src="/logo.png"
              alt="לוגו האתר"
              width={48}
              height={48}
              className="rounded-full object-cover h-12 w-12 ring-2 ring-white/10"
            />
            <span className="font-semibold text-[var(--foreground)] tracking-tight">ניהול הוצאות טיול</span>
          </Link>
        </header>
        <PushSetup />
        <main className="flex-1">{children}</main>
        <footer className="text-center text-[var(--muted)] text-sm py-3 px-2 border-t border-white/10 flex flex-col items-center gap-2 bg-white/[0.02]">
          <InstallAppButton />
          <span>ניבנה ע&quot;י אלי לבין</span>
        </footer>
      </body>
    </html>
  );
}
