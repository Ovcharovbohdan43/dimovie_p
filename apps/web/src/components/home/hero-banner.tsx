"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlayMark } from "@/components/home/marks";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2400&q=80";

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

  const imageScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.22]);
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

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
          alt="Dark cinema auditorium before the lights go down"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </motion.div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,12,0.92)_0%,rgba(8,8,12,0.55)_42%,rgba(8,8,12,0.25)_70%,rgba(8,8,12,0.45)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,12,0.55)_0%,transparent_28%,transparent_55%,rgba(8,8,12,0.85)_82%,#08080c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

      <motion.div
        className="relative mx-auto flex min-h-[100svh] w-full max-w-[1920px] flex-col justify-end px-4 pb-20 pt-28 sm:px-6 sm:pb-24 md:justify-center md:px-10 md:pb-16 md:pt-24 lg:px-14"
        style={reduceMotion ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <div className="max-w-[42rem] md:mt-8">
          <motion.p
            className="font-display text-[clamp(3.5rem,11vw,7.75rem)] font-bold leading-[0.88] tracking-[-0.045em] text-[#e50914]"
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            DiMovie
          </motion.p>

          <motion.h1
            className="mt-5 max-w-[16ch] font-display text-[clamp(1.85rem,4.6vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            Watch together. Stay in sync.
          </motion.h1>

          <motion.p
            className="mt-4 max-w-[34ch] text-base leading-relaxed text-white/72 sm:mt-5 sm:text-lg"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            Open a room, share one link, and feel the same cut — voice, chat, and
            playback locked under 500ms.
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
