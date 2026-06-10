import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import AppChrome from "@/components/AppChrome";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yonderful.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Yonderful — wander, don't navigate",
    template: "%s · Yonderful",
  },
  description:
    "Strava for exploring. Pick a place, wander there with no route — just an arrow and your own two feet. Detours encouraged.",
  applicationName: "Yonderful",
  keywords: [
    "exploring",
    "wandering",
    "walking",
    "no navigation",
    "compass",
    "adventure",
    "getting lost",
  ],
  appleWebApp: {
    capable: true,
    title: "Yonderful",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "Yonderful",
    title: "Yonderful — wander, don't navigate",
    description:
      "Pick a place, wander there with no route — just an arrow and your own two feet.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Yonderful — wander, don't navigate",
    description:
      "Pick a place, wander there with no route — just an arrow and your own two feet.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${mono.variable} h-full antialiased`}
    >
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
