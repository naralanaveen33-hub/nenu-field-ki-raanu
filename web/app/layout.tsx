import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartFarm Voice - స్మార్ట్‌ఫామ్ వాయిస్ | Intelligent Irrigation",
  description: "Smart agriculture field monitoring, Telugu voice assistant, and intelligent weather-informed irrigation platform for farmers.",
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="te" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-[#06110d] text-slate-900 dark:text-slate-100 selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
