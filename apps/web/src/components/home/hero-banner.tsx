"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlayMark } from "@/components/home/marks";
import { DiMovieMark } from "@/components/brand/dimovie-logo";

const HERO_IMAGE = "/landing/hero-party.png";

interface HeroBannerProps {
  isAuthenticated?: boolean;
}

export function HeroBanner({ isAuthenticated }: HeroBannerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  // useScroll can report progress=1 before layout; gate transforms until mounted.
  const [scrollReady, setScrollReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setScrollReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const imageScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.14]);
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const parallaxOn = !reduceMotion && scrollReady;

  return (
    <section
      ref={sectionRef}
      className="relative isolate min-h-[100svh] w-full overflow-hidden"
    >
      <motion.div
        className="absolute inset-0"
        style={parallaxOn ? { scale: imageScale, y: imageY } : undefined}
      >
        <Image
          src={HERO_IMAGE}
          alt="DiMovie watch party with synced video and live chat"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[32%_18%] sm:object-[36%_16%] md:object-[40%_14%]"
        />
      </motion.div>

      {/* Left-anchored wash: keep copy readable, mute the product chat rail on the right */}
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(5,5,8,0.97)_0%,rgba(5,5,8,0.88)_34%,rgba(5,5,8,0.42)_58%,rgba(5,5,8,0.72)_82%,rgba(5,5,8,0.9)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(270deg,rgba(5,5,8,0.78)_0%,rgba(5,5,8,0.35)_22%,transparent_48%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,8,0.55)_0%,transparent_28%,transparent_48%,rgba(8,8,12,0.9)_84%,#08080c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

      <motion.div
        className="relative mx-auto flex min-h-[100svh] w-full max-w-[1920px] flex-col justify-end px-4 pb-[max(5rem,env(safe-area-inset-bottom))] pt-24 sm:px-6 sm:pb-24 sm:pt-28 md:justify-center md:px-10 md:pb-16 md:pt-24 lg:px-14"
        style={parallaxOn ? { y: contentY, opacity: contentOpacity } : undefined}
      >
        <div className="w-full max-w-[40rem] md:mt-8">
          <div
            className={cn(
              "flex items-center gap-2.5 sm:gap-3 md:gap-4",
              !reduceMotion && "dm-hero-enter",
            )}
          >
            <DiMovieMark className="size-10 shrink-0 text-[#e50914] sm:size-14 md:size-[clamp(3.5rem,7vw,5.5rem)]" />
            <p className="min-w-0 font-display text-[clamp(2.35rem,11vw,7.75rem)] font-bold leading-[0.9] tracking-[-0.045em] text-[#e50914]">
              DiMovie
            </p>
          </div>

          <h1
            className={cn(
              "mt-4 max-w-[18ch] font-display text-[clamp(1.55rem,5.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:mt-5",
              !reduceMotion && "dm-hero-enter dm-hero-enter-delay-1",
            )}
          >
            Host a room. Sync the cut. Talk through it.
          </h1>

          <p
            className={cn(
              "mt-3 max-w-[38ch] text-[0.95rem] leading-relaxed text-white/72 sm:mt-5 sm:text-lg",
              !reduceMotion && "dm-hero-enter dm-hero-enter-delay-2",
            )}
          >
            Watch parties with server-locked playback, voice, and live chat —
            share one link and everyone lands on the same frame.
          </p>

          <div
            className={cn(
              "mt-7 flex w-full flex-col gap-2.5 sm:mt-10 sm:flex-row sm:items-center sm:gap-3",
              !reduceMotion && "dm-hero-enter dm-hero-enter-delay-3",
            )}
          >
            <Link
              href={isAuthenticated ? "/dashboard?create=true" : "/register"}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 w-full justify-center bg-white px-6 text-sm font-semibold text-black hover:bg-white/92 sm:h-12 sm:w-auto sm:px-7 sm:text-[0.95rem]",
              )}
            >
              <PlayMark className="mr-2 size-4" />
              {isAuthenticated ? "Start watch party" : "Start free"}
            </Link>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-11 w-full justify-center border-white/25 bg-white/[0.08] px-6 text-sm font-medium text-white backdrop-blur-md hover:bg-white/[0.14] sm:h-12 sm:w-auto sm:px-7 sm:text-[0.95rem]",
              )}
            >
              See plans
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
