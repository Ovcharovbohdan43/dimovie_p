"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, AuthUser } from "@dimovie/shared";
import { api, clearToken, getToken, setToken } from "@/lib/api";

export function useAuth() {
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setAuthReady(true);
  }, []);

  const hasToken = authReady && !!getToken();

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<AuthUser>("/auth/me"),
    enabled: authReady && hasToken,
    retry: false,
    staleTime: 60_000,
  });

  const login = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      setToken(data.accessToken);
      qc.setQueryData(["auth", "me"], data.user);
    },
  });

  const register = useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      displayName: string;
    }) =>
      api<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      setToken(data.accessToken);
      qc.setQueryData(["auth", "me"], data.user);
    },
  });

  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      clearToken();
      qc.setQueryData(["auth", "me"], null);
    },
  });

  const isAuthenticated = Boolean(hasToken && me.data);

  useEffect(() => {
    if (!authReady || !hasToken || !me.isError) return;
    clearToken();
    qc.setQueryData(["auth", "me"], null);
  }, [authReady, hasToken, me.isError, qc]);

  return { me, login, register, logout, authReady, hasToken, isAuthenticated };
}
