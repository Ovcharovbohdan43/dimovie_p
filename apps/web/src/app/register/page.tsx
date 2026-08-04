"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@dimovie/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CinematicShell } from "@/components/layout/cinematic-shell";

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    await registerUser.mutateAsync(data);
    router.push("/dashboard");
  };

  return (
    <CinematicShell
      imageSrc="https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=2400&q=80"
      imageAlt="Projector light in a dark theater"
    >
      <div className="space-y-7">
        <div className="text-center">
          <p className="font-display text-4xl font-bold tracking-[-0.04em] text-[#e50914]">
            DiMovie
          </p>
          <h1 className="mt-3 font-display text-xl font-semibold tracking-[-0.02em] text-white">
            Create your free account
          </h1>
          <p className="mt-1.5 text-sm text-white/50">
            Open a room and invite the night in
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              {...register("displayName")}
              className="mt-1 h-11 border-white/10 bg-white/[0.04]"
            />
            {errors.displayName && (
              <p className="mt-1 text-xs text-[#e50914]">
                {errors.displayName.message}
              </p>
            )}
          </div>
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

          {registerUser.error && (
            <p className="text-sm text-[#e50914]">{registerUser.error.message}</p>
          )}

          <Button
            type="submit"
            className="h-11 w-full bg-[#e50914] text-[0.95rem] font-semibold hover:bg-[#f40612]"
            disabled={registerUser.isPending}
          >
            {registerUser.isPending ? "Creating..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link href="/login" className="text-[#00a8e1] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </CinematicShell>
  );
}
