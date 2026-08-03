"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@dimovie/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    await login.mutateAsync(data);
    router.push(redirect);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-white/10 bg-[#181818] p-8">
        <div className="text-center">
          <h1 className="text-3xl font-black text-[#e50914]">DiMovie</h1>
          <p className="mt-2 text-white/60">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              className="mt-1 border-white/10 bg-white/5"
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
              className="mt-1 border-white/10 bg-white/5"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-[#e50914]">
                {errors.password.message}
              </p>
            )}
          </div>

          {login.error && (
            <p className="text-sm text-[#e50914]">{login.error.message}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#e50914] hover:bg-[#f40612]"
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
            <span className="bg-[#181818] px-2 text-white/40">or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`${API_URL}/auth/google`}
            className={cn(buttonVariants({ variant: "outline" }), "border-white/10 text-center")}
          >
            Google
          </a>
          <a
            href={`${API_URL}/auth/discord`}
            className={cn(buttonVariants({ variant: "outline" }), "border-white/10 text-center")}
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
    </div>
  );
}
