import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { Navbar } from "@/components/layout/navbar";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
    <html lang="en" className={`${inter.variable} dark h-full`}>
      <body className="min-h-full bg-[#0b0b0f] font-sans text-white antialiased">
        <QueryProvider>
          <Navbar />
          <main>{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
