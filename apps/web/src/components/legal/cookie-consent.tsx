"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { COOKIE_CATEGORY_COPY } from "@/lib/legal/cookies";
import {
  ACCEPT_ALL_PREFERENCES,
  DEFAULT_COOKIE_PREFERENCES,
  REJECT_NON_ESSENTIAL_PREFERENCES,
  readCookieConsent,
  writeCookieConsent,
  type CookiePreferences,
} from "@/lib/cookies/consent";
import { cn } from "@/lib/utils";
import { DiMovieLogo } from "@/components/brand/dimovie-logo";

type PanelMode = "banner" | "settings" | "hidden";

function PreferenceToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition",
        checked
          ? "border-[#e50914]/50 bg-[#e50914]"
          : "border-white/15 bg-white/10",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]",
          checked ? "left-[1.35rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function CookieConsent() {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<PanelMode>("hidden");
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<CookiePreferences>(DEFAULT_COOKIE_PREFERENCES);

  useEffect(() => {
    const existing = readCookieConsent();
    if (existing) {
      setDraft(existing.preferences);
      setMode("hidden");
    } else {
      setMode("banner");
    }
    setReady(true);

    const openSettings = () => {
      const current = readCookieConsent();
      setDraft(current?.preferences ?? DEFAULT_COOKIE_PREFERENCES);
      setMode("settings");
    };
    window.addEventListener("dimovie:open-cookie-settings", openSettings);
    return () =>
      window.removeEventListener("dimovie:open-cookie-settings", openSettings);
  }, []);

  const persist = (preferences: CookiePreferences) => {
    const next = writeCookieConsent(preferences);
    setDraft(next.preferences);
    setMode("hidden");
  };

  if (!ready || mode === "hidden") return null;

  return (
    <AnimatePresence>
      <motion.div
        key={mode}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-desc"
        className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-5 md:p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 20 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[18px] border border-white/10 bg-[#0e0e14]/94 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div
            aria-hidden
            className="h-px w-full bg-gradient-to-r from-transparent via-[#e50914]/70 to-transparent"
          />
          <div className="p-5 sm:p-6">
            <DiMovieLogo
              markClassName="size-5"
              wordmarkClassName="text-xs uppercase tracking-[0.08em]"
              className="gap-1.5"
            />
            <h2
              id="cookie-consent-title"
              className="mt-1.5 font-display text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl"
            >
              {mode === "settings" ? "Cookie settings" : "We use cookies"}
            </h2>
            <p
              id="cookie-consent-desc"
              className="mt-2 max-w-[52ch] text-sm leading-relaxed text-white/55"
            >
              We use cookies and similar tech for essential features, and —
              only with your choice — for functional, analytics, and marketing
              purposes. Read the{" "}
              <Link
                href="/cookies"
                className="text-[#00a8e1] underline-offset-2 hover:underline"
              >
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-[#00a8e1] underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>

            {mode === "settings" ? (
              <div className="mt-5 space-y-3">
                {(
                  Object.keys(COOKIE_CATEGORY_COPY) as Array<
                    keyof typeof COOKIE_CATEGORY_COPY
                  >
                ).map((key) => {
                  const copy = COOKIE_CATEGORY_COPY[key];
                  const checked = draft[key];
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">
                          {copy.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-white/45">
                          {copy.description}
                        </p>
                      </div>
                      <PreferenceToggle
                        label={copy.title}
                        checked={checked}
                        disabled={copy.required}
                        onChange={(next) =>
                          setDraft((prev) => ({ ...prev, [key]: next, necessary: true }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {mode === "banner" ? (
                <>
                  <Button
                    type="button"
                    className="h-10 bg-[#e50914] px-4 font-semibold hover:bg-[#f40612] sm:min-w-[8.5rem]"
                    onClick={() => persist(ACCEPT_ALL_PREFERENCES)}
                  >
                    Accept all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-white/15 bg-white/[0.04] px-4 text-white hover:bg-white/10"
                    onClick={() => persist(REJECT_NON_ESSENTIAL_PREFERENCES)}
                  >
                    Reject non-essential
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-4 text-white/70 hover:bg-white/5 hover:text-white"
                    onClick={() => setMode("settings")}
                  >
                    Customize
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    className="h-10 bg-[#e50914] px-4 font-semibold hover:bg-[#f40612] sm:min-w-[8.5rem]"
                    onClick={() => persist(draft)}
                  >
                    Save choices
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-white/15 bg-white/[0.04] px-4 text-white hover:bg-white/10"
                    onClick={() => persist(ACCEPT_ALL_PREFERENCES)}
                  >
                    Accept all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-4 text-white/70 hover:bg-white/5 hover:text-white"
                    onClick={() => {
                      const existing = readCookieConsent();
                      if (existing) setMode("hidden");
                      else setMode("banner");
                    }}
                  >
                    Back
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
