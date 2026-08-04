"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@dimovie/shared";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface RoomGuestAuthModalProps {
  roomCode: string;
  hostName?: string;
  onAuthenticated: () => void | Promise<void>;
}

export function RoomGuestAuthModal({
  roomCode,
  hostName,
  onAuthenticated,
}: RoomGuestAuthModalProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const { login, register: registerUser } = useAuth();

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const handleLogin = async (data: LoginInput) => {
    await login.mutateAsync(data);
    await onAuthenticated();
  };

  const handleRegister = async (data: RegisterInput) => {
    await registerUser.mutateAsync(data);
    await onAuthenticated();
  };

  const pending = login.isPending || registerUser.isPending;
  const error = login.error ?? registerUser.error;

  return (
    <Dialog open disablePointerDismissal onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md border-white/10 bg-[#0e0e14]/92 text-white backdrop-blur-xl sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-semibold tracking-[-0.02em]">
            Sign in to watch together
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Room {roomCode}
            {hostName ? ` · host ${hostName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setMode("register")}
            className={cn(
              "flex-1 cursor-pointer select-none py-2 text-sm font-medium transition",
              mode === "register"
                ? "bg-[#e50914] text-white"
                : "text-white/50 hover:text-white",
            )}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={cn(
              "flex-1 cursor-pointer select-none py-2 text-sm font-medium transition",
              mode === "login"
                ? "bg-[#e50914] text-white"
                : "text-white/50 hover:text-white",
            )}
          >
            Sign in
          </button>
        </div>

        {mode === "register" ? (
          <form
            onSubmit={registerForm.handleSubmit(handleRegister)}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="guest-displayName">Display name</Label>
              <Input
                id="guest-displayName"
                {...registerForm.register("displayName")}
                className="mt-1 h-11 border-white/10 bg-white/[0.04]"
                autoComplete="nickname"
              />
              {registerForm.formState.errors.displayName && (
                <p className="mt-1 text-xs text-[#e50914]">
                  {registerForm.formState.errors.displayName.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="guest-email-reg">Email</Label>
              <Input
                id="guest-email-reg"
                type="email"
                {...registerForm.register("email")}
                className="mt-1 h-11 border-white/10 bg-white/[0.04]"
                autoComplete="email"
              />
              {registerForm.formState.errors.email && (
                <p className="mt-1 text-xs text-[#e50914]">
                  {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="guest-password-reg">Password</Label>
              <Input
                id="guest-password-reg"
                type="password"
                {...registerForm.register("password")}
                className="mt-1 h-11 border-white/10 bg-white/[0.04]"
                autoComplete="new-password"
              />
              {registerForm.formState.errors.password && (
                <p className="mt-1 text-xs text-[#e50914]">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-[#e50914] font-semibold hover:bg-[#f40612]"
              disabled={pending}
            >
              {pending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating account...
                </>
              ) : (
                "Create account and join room"
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="guest-email-login">Email</Label>
              <Input
                id="guest-email-login"
                type="email"
                {...loginForm.register("email")}
                className="mt-1 h-11 border-white/10 bg-white/[0.04]"
                autoComplete="email"
              />
              {loginForm.formState.errors.email && (
                <p className="mt-1 text-xs text-[#e50914]">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="guest-password-login">Password</Label>
              <Input
                id="guest-password-login"
                type="password"
                {...loginForm.register("password")}
                className="mt-1 h-11 border-white/10 bg-white/[0.04]"
                autoComplete="current-password"
              />
              {loginForm.formState.errors.password && (
                <p className="mt-1 text-xs text-[#e50914]">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-[#e50914] font-semibold hover:bg-[#f40612]"
              disabled={pending}
            >
              {pending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Signing in...
                </>
              ) : (
                "Join room"
              )}
            </Button>
          </form>
        )}

        {error && (
          <p className="text-center text-sm text-[#e50914]">{error.message}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
