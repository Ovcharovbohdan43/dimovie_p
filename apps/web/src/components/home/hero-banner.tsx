"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
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
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const imageScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.14]);
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate min-h-[100svh] w-full overflow-hidden"
    >
      <motion.div
        className="absolute inset-0"
        style={
          reduceMotion
            ? undefined
            : { scale: imageScale, y: imageY }
        }
      >
        <Image
          src={HERO_IMAGE}
          alt="DiMovie watch party with synced video and live chat"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_28%] md:object-[center_22%]"
        />
      </motion.div>

      {/* Left-weighted wash so brand + copy stay readable over the product UI */}
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(5,5,8,0.94)_0%,rgba(5,5,8,0.72)_34%,rgba(5,5,8,0.28)_62%,rgba(5,5,8,0.55)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,8,0.5)_0%,transparent_30%,transparent_52%,rgba(8,8,12,0.88)_86%,#08080c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

      <motion.div
        className="relative mx-auto flex min-h-[100svh] w-full max-w-[1920px] flex-col justify-end px-4 pb-20 pt-28 sm:px-6 sm:pb-24 md:justify-center md:px-10 md:pb-16 md:pt-24 lg:px-14"
        style={reduceMotion ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <div className="max-w-[40rem] md:mt-8">
          <motion.div
            className="flex items-center gap-3 sm:gap-4"
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <DiMovieMark className="size-[clamp(2.75rem,8vw,5.5rem)] text-[#e50914]" />
            <p className="font-display text-[clamp(3.5rem,11vw,7.75rem)] font-bold leading-[0.88] tracking-[-0.045em] text-[#e50914]">
              DiMovie
            </p>
          </motion.div>

          <motion.h1
            className="mt-5 max-w-[18ch] font-display text-[clamp(1.85rem,4.6vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            Host a room. Sync the cut. Talk through it.
          </motion.h1>

          <motion.p
            className="mt-4 max-w-[38ch] text-base leading-relaxed text-white/72 sm:mt-5 sm:text-lg"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            Watch parties with server-locked playback, voice, and live chat —
            share one link and everyone lands on the same frame.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href={isAuthenticated ? "/dashboard?create=true" : "/register"}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 w-full justify-center bg-white px-7 text-[0.95rem] font-semibold text-black hover:bg-white/92 sm:w-auto",
              )}
            >
              <PlayMark className="mr-2 size-4" />
              {isAuthenticated ? "Start watch party" : "Start free"}
            </Link>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 w-full justify-center border-white/25 bg-white/[0.08] px-7 text-[0.95rem] font-medium text-white backdrop-blur-md hover:bg-white/[0.14] sm:w-auto",
              )}
            >
              See plans
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
