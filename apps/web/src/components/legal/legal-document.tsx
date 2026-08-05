import Link from "next/link";
import { LEGAL_META, type LegalDocument } from "@/lib/legal/meta";
import { cn } from "@/lib/utils";

const LEGAL_NAV = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
] as const;

function SectionBlock({
  title,
  paragraphs,
  bullets,
}: {
  title?: string;
  paragraphs?: string[];
  bullets?: string[];
}) {
  return (
    <div className="space-y-3">
      {title ? (
        <h3 className="font-display text-base font-semibold tracking-[-0.02em] text-white/90">
          {title}
        </h3>
      ) : null}
      {paragraphs?.map((paragraph, index) => (
        <p
          key={`${title ?? "p"}-${index}`}
          className="text-sm leading-relaxed text-white/60 md:text-[0.95rem]"
        >
          {paragraph}
        </p>
      ))}
      {bullets && bullets.length > 0 ? (
        <ul className="space-y-2 border-l border-white/10 pl-4">
          {bullets.map((item, index) => (
            <li
              key={`${title ?? "b"}-${index}`}
              className="text-sm leading-relaxed text-white/60 md:text-[0.95rem]"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LegalDocumentView({
  document,
}: {
  document: LegalDocument;
}) {
  return (
    <div className="dm-app relative min-h-[100svh]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(229,9,20,0.14),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(0,168,225,0.08),transparent_40%)]"
      />

      <div className="relative mx-auto max-w-3xl px-4 pb-20 pt-24 sm:px-6 md:px-8 md:pt-28">
        <p className="font-display text-sm font-semibold tracking-[-0.02em] text-[#e50914]">
          {LEGAL_META.productName}
        </p>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
          {document.title}
        </h1>
        <p className="mt-3 max-w-[54ch] text-sm text-white/55 md:text-base">
          {document.description}
        </p>
        <p className="mt-4 text-xs text-white/35">
          Last updated {LEGAL_META.lastUpdatedLabel}
        </p>

        <nav
          aria-label="Legal documents"
          className="mt-8 flex flex-wrap gap-2 border-y border-white/8 py-3"
        >
          {LEGAL_NAV.map((item) => {
            const active = item.href === `/${document.slug}`;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 space-y-4">
          <p className="text-sm leading-relaxed text-white/65 md:text-[0.95rem]">
            {document.intro}
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {document.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-28 space-y-4"
            >
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                {section.title}
              </h2>
              <SectionBlock
                paragraphs={section.paragraphs}
                bullets={section.bullets}
              />
              {section.subsections?.map((sub) => (
                <SectionBlock
                  key={sub.title}
                  title={sub.title}
                  paragraphs={sub.paragraphs}
                  bullets={sub.bullets}
                />
              ))}
            </section>
          ))}
        </div>

        <div className="mt-16 border-t border-white/8 pt-8 text-sm text-white/40">
          Questions?{" "}
          <a
            href={`mailto:${LEGAL_META.privacyEmail}`}
            className="text-[#00a8e1] transition hover:text-[#5bc0eb]"
          >
            {LEGAL_META.privacyEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
