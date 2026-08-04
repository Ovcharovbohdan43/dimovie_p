import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { Navbar } from "@/components/layout/navbar";
import { MotionProvider } from "@/providers/motion-provider";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
      <body className="min-h-full bg-[#08080c] font-sans text-white antialiased">
        <QueryProvider>
          <MotionProvider>
            <Navbar />
            <main>{children}</main>
          </MotionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
