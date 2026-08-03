"use client";

import Link from "next/link";
import { Play, Users, Zap } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroBannerProps {
  isAuthenticated?: boolean;
}

export function HeroBanner({ isAuthenticated }: HeroBannerProps) {
  return (
    <section className="relative min-h-[85vh] w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(11,11,15,0.4), rgba(11,11,15,0.9)), 
            radial-gradient(ellipse at 70% 30%, rgba(229,9,20,0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 20% 80%, rgba(0,168,225,0.1) 0%, transparent 40%),
            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="hero-vignette absolute inset-0" />
      <div className="hero-bottom-fade absolute inset-x-0 bottom-0 h-48" />

      <div className="relative mx-auto flex min-h-[85vh] max-w-[1920px] flex-col justify-end px-4 pb-24 pt-32 md:px-8 lg:px-12 lg:pb-32">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#00a8e1]">
            Watch Together
          </p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-gradient-hero md:text-6xl lg:text-7xl">
            Cinema-quality watch parties, synced in real time
          </h1>
          <p className="max-w-lg text-lg text-white/70">
            Create a room, invite friends, and experience movies together —
            with ultra-low latency sync, voice chat, and reactions.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href={isAuthenticated ? "/dashboard?create=true" : "/register"}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 bg-white px-8 text-base font-bold text-black hover:bg-white/90",
              )}
            >
              <Play className="mr-2 size-5 fill-current" />
              {isAuthenticated ? "Start Watch Party" : "Start Free"}
            </Link>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 border-white/30 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur hover:bg-white/20",
              )}
            >
              View Plans
            </Link>
          </div>

          <div className="flex flex-wrap gap-6 pt-6 text-sm text-white/50">
            <span className="flex items-center gap-2">
              <Zap className="size-4 text-[#e50914]" />
              &lt;500ms sync
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4 text-[#00a8e1]" />
              Up to 500 viewers
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
