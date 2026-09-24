import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["600", "700", "800"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FirstLook — Tax-Sale Deal Screener",
  description:
    "Upload a county tax-sale list. FirstLook ranks which properties to chase first — with scores, red flags, research links, and max-bid estimates.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${manrope.variable}`}>
      <body
        style={{
          fontFamily: "var(--font-manrope), var(--font-body)",
          ["--font-display" as string]: "var(--font-syne), var(--font-display)",
          margin: 0,
          overflowX: "clip",
          maxWidth: "100vw",
        }}
      >
        {children}
      </body>
    </html>
  );
}
