"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { persistSession, setToken } from "@/lib/api";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    void (async () => {
      setToken(token);
      // Bind httpOnly refresh cookie to this site via /backend rewrite.
      const ok = await persistSession();
      if (cancelled) return;
      if (!ok) {
        setError("Couldn’t finish sign-in. Try again.");
        window.setTimeout(() => router.replace("/login"), 1600);
        return;
      }
      sessionStorage.setItem("dimovie_session_persisted", "1");
      router.replace("/dashboard");
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-[#e50914]" />
      {error ? (
        <p className="text-sm text-[#ff6b73]">{error}</p>
      ) : (
        <p className="text-sm text-white/50">Finishing sign-in…</p>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-[#e50914]" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
