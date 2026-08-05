import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { Navbar } from "@/components/layout/navbar";
import { MotionProvider } from "@/providers/motion-provider";
import { SiteFooter } from "@/components/legal/site-footer";
import { CookieConsent } from "@/components/legal/cookie-consent";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "DiMovie — Watch Together",
  description:
    "Cinema-quality synchronized watch parties with voice chat and ultra-low latency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${syne.variable} dark h-full`}
    >
      <body className="dm-app min-h-full font-sans font-normal text-white antialiased">
        <QueryProvider>
          <MotionProvider>
            <Navbar />
            <main className="relative">{children}</main>
            <SiteFooter />
            <CookieConsent />
          </MotionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
