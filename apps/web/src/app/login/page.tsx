"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginSchema,
  type LoginInput,
  SECURITY_ERROR_CODES,
} from "@dimovie/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL, ApiError } from "@/lib/api";
import { toUserMessage } from "@/lib/user-message";
import { CinematicShell } from "@/components/layout/cinematic-shell";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import {
  TurnstileWidget,
  useSecurityChallenge,
} from "@/components/security/turnstile-widget";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen message="Loading..." className="h-screen bg-[#08080c]" />
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";
  const { login } = useAuth();
  const challenge = useSecurityChallenge();
  const [forceCaptcha, setForceCaptcha] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const showCaptcha = forceCaptcha || challenge.captchaRequired;

  const onSubmit = async (data: LoginInput) => {
    try {
      await login.mutateAsync({
        ...data,
        captchaToken: challenge.captchaToken ?? undefined,
      });
      router.push(redirect);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === SECURITY_ERROR_CODES.CAPTCHA_REQUIRED
      ) {
        setForceCaptcha(true);
        await challenge.refresh();
      }
    }
  };

  return (
    <CinematicShell>
      <div className="space-y-7">
        <div className="text-center">
          <p className="font-display text-4xl font-bold tracking-[-0.04em] text-[#e50914]">
            DiMovie
          </p>
          <h1 className="mt-3 font-display text-xl font-semibold tracking-[-0.02em] text-white">
            Sign in to your account
          </h1>
          <p className="mt-1.5 text-sm text-white/50">
            Pick up where the room left off
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              className="mt-1 h-11 border-white/10 bg-white/[0.04]"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-[#e50914]">{errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              className="mt-1 h-11 border-white/10 bg-white/[0.04]"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-[#e50914]">
                {errors.password.message}
              </p>
            )}
          </div>

          {showCaptcha && challenge.siteKey ? (
            <TurnstileWidget
              siteKey={challenge.siteKey}
              onToken={challenge.setCaptchaToken}
            />
          ) : null}

          {login.error && (
            <p className="text-sm text-[#e50914]">
              {toUserMessage(login.error.message)}
            </p>
          )}

          <Button
            type="submit"
            className="h-11 w-full bg-[#e50914] text-[0.95rem] font-semibold hover:bg-[#f40612]"
            disabled={login.isPending}
          >
            {login.isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0e0e14]/90 px-2 text-white/40">
              or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`${API_URL}/auth/google`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 border-white/12 bg-white/[0.03] text-center hover:bg-white/[0.08]",
            )}
          >
            Google
          </a>
          <a
            href={`${API_URL}/auth/discord`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 border-white/12 bg-white/[0.03] text-center hover:bg-white/[0.08]",
            )}
          >
            Discord
          </a>
        </div>

        <p className="text-center text-sm text-white/50">
          No account?{" "}
          <Link href="/register" className="text-[#00a8e1] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </CinematicShell>
  );
}
