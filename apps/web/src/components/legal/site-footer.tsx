"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEGAL_META } from "@/lib/legal/meta";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/cookies", label: "Cookie Policy" },
] as const;

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/room/")) return null;

  return (
    <footer className="relative z-[1] border-t border-white/6 bg-[#06060a]/90">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between md:px-10 lg:px-14">
        <div className="max-w-sm">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-[-0.04em] text-[#e50914]"
          >
            {LEGAL_META.productName}
          </Link>
          <p className="mt-2 text-sm leading-relaxed text-white/40">
            Synchronized watch parties with voice and chat — built for the night
            you actually press play together.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <nav
            aria-label="Legal"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/45"
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              className="text-left transition hover:text-white"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("dimovie:open-cookie-settings"))
              }
            >
              Cookie settings
            </button>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-2 px-4 py-4 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-10 lg:px-14">
          <p>
            © {new Date().getFullYear()} {LEGAL_META.productName}. All rights
            reserved.
          </p>
          <p>Watch together. Stay in sync.</p>
        </div>
      </div>
    </footer>
  );
}
