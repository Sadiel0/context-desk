import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Files live in the repo so `next build` does not call fonts.googleapis.com.
const sans = localFont({
  src: [
    { path: "./fonts/source-sans-3-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source-sans-3-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/source-sans-3-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/source-sans-3-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-source-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

const serif = localFont({
  src: [
    { path: "./fonts/newsreader-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/newsreader-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Context desk",
  description: "Personal trading context desk",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#141210",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
