import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["500", "600", "700"],
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "FirstLook — Tax-sale bid discipline",
  description:
    "Upload an official county tax-sale list. Get a look-first shortlist, hard max bid, county rules, diligence checklist, and auction bid sheet.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body
        style={{
          fontFamily: "var(--font-plex), var(--font-body), system-ui, sans-serif",
          ["--font-display" as string]: "var(--font-space), var(--font-display)",
          margin: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
