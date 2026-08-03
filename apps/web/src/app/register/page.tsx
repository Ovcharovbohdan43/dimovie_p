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
    <div className="flex min-h-screen items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-white/10 bg-[#181818] p-8">
        <div className="text-center">
          <h1 className="text-3xl font-black text-[#e50914]">DiMovie</h1>
          <p className="mt-2 text-white/60">Create your free account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              {...register("displayName")}
              className="mt-1 border-white/10 bg-white/5"
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

          {registerUser.error && (
            <p className="text-sm text-[#e50914]">{registerUser.error.message}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#e50914] hover:bg-[#f40612]"
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
    </div>
  );
}
