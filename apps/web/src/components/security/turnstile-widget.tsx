"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicApi, getToken } from "@/lib/api";
import type { SecurityChallengeStatus } from "@dimovie/shared";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "dark" | "light" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
}

export function useSecurityChallenge() {
  const [status, setStatus] = useState<SecurityChallengeStatus | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const next = await publicApi<SecurityChallengeStatus>(
        "/security/challenge",
        { headers },
      );
      setStatus(next);
      if (!next.captchaRequired) setCaptchaToken(null);
      return next;
    } catch {
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    captchaToken,
    setCaptchaToken,
    refresh,
    loading,
    captchaRequired: Boolean(status?.captchaRequired),
    siteKey:
      status?.siteKey ||
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      null,
  };
}

export function TurnstileWidget({
  siteKey,
  onToken,
  className,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadTurnstileScript();
        if (cancelled || !hostRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          callback: (token) => onToken(token),
          "error-callback": () => onToken(null),
          "expired-callback": () => onToken(null),
        });
      } catch {
        onToken(null);
      }
    })();
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken]);

  return <div ref={hostRef} className={className} />;
}
