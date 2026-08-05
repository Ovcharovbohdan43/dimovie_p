"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, AuthUser } from "@dimovie/shared";
import {
  api,
  clearToken,
  getToken,
  persistSession,
  refreshAccessToken,
  setToken,
  ApiError,
} from "@/lib/api";

export function useAuth() {
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setAuthReady(true);
  }, []);

  const hasToken = authReady && !!getToken();

  // Bind refresh cookie to this origin once per browser session (OAuth / old tabs).
  useEffect(() => {
    if (!authReady || !getToken()) return;
    const key = "dimovie_session_persisted";
    if (sessionStorage.getItem(key) === "1") return;
    void persistSession().then((ok) => {
      if (ok) sessionStorage.setItem(key, "1");
    });
  }, [authReady, hasToken]);

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<AuthUser>("/auth/me"),
    enabled: authReady && hasToken,
    retry: 1,
    staleTime: 60_000,
  });

  const login = useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      captchaToken?: string;
    }) =>
      api<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
        skipAuthRefresh: true,
      }),
    onSuccess: (data) => {
      setToken(data.accessToken);
      sessionStorage.setItem("dimovie_session_persisted", "1");
      qc.setQueryData(["auth", "me"], data.user);
    },
  });

  const register = useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      displayName: string;
      captchaToken?: string;
    }) =>
      api<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
        skipAuthRefresh: true,
      }),
    onSuccess: (data) => {
      setToken(data.accessToken);
      sessionStorage.setItem("dimovie_session_persisted", "1");
      qc.setQueryData(["auth", "me"], data.user);
    },
  });

  const logout = useMutation({
    mutationFn: () =>
      api("/auth/logout", { method: "POST", skipAuthRefresh: true }),
    onSuccess: () => {
      clearToken();
      sessionStorage.removeItem("dimovie_session_persisted");
      qc.setQueryData(["auth", "me"], null);
    },
  });

  const isAuthenticated = Boolean(hasToken && me.data);

  useEffect(() => {
    if (!authReady || !hasToken || !me.isError) return;

    let cancelled = false;
    void (async () => {
      // Last chance: cookie refresh may still revive the session.
      const next = await refreshAccessToken();
      if (cancelled) return;
      if (next) {
        await qc.invalidateQueries({ queryKey: ["auth", "me"] });
        return;
      }
      // Only drop the session on hard auth failures.
      const status = me.error instanceof ApiError ? me.error.status : 0;
      if (status === 401 || status === 403) {
        clearToken();
        sessionStorage.removeItem("dimovie_session_persisted");
        qc.setQueryData(["auth", "me"], null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, hasToken, me.isError, me.error, qc]);

  return { me, login, register, logout, authReady, hasToken, isAuthenticated };
}
