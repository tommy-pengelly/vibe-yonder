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

// The canonical site URL, drives OG/canonical/metadataBase. Override per-env
// with NEXT_PUBLIC_SITE_URL (e.g. for preview deploys); defaults to the domain.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yonderful.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Yonderful · eyes up, wander",
    template: "%s · Yonderful",
  },
  description:
    "Vibe walking for the curious. Take a bearing, not a route, and find your own way there on foot. Eyes up: stumble onto good, local, independent things, and brag about how far you strayed.",
  applicationName: "Yonderful",
  keywords: [
    "exploring",
    "vibe walking",
    "wandering",
    "walking",
    "local",
    "independent",
    "no navigation",
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
    title: "Yonderful · eyes up, wander",
    description:
      "A bearing, not a route. Wander your own way on foot and stumble onto good, local things. Eyes up.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Yonderful · eyes up, wander",
    description:
      "A bearing, not a route. Wander your own way on foot and stumble onto good, local things. Eyes up.",
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
