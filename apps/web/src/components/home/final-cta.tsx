"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlayMark } from "@/components/home/marks";

interface FinalCtaProps {
  isAuthenticated?: boolean;
}

export function FinalCta({ isAuthenticated }: FinalCtaProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative mx-auto max-w-[1920px] overflow-hidden px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-14">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(229,9,20,0.18),transparent_55%),radial-gradient(ellipse_at_80%_100%,rgba(0,168,225,0.1),transparent_45%)]"
      />
      <motion.div
        className="relative mx-auto max-w-3xl text-center"
        initial={reduceMotion ? false : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
          Open a room. Send the link. Press play.
        </h2>
        <p className="mx-auto mt-4 max-w-[40ch] text-sm text-white/60 md:text-base">
          Free to start. Sync, voice, and chat in one place — so the reaction
          hits on the same frame for everyone.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href={isAuthenticated ? "/dashboard?create=true" : "/register"}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 justify-center bg-[#e50914] px-8 text-[0.95rem] font-semibold hover:bg-[#f40612]",
            )}
          >
            <PlayMark className="mr-2 size-4" />
            {isAuthenticated ? "Create a room" : "Create free account"}
          </Link>
          {!isAuthenticated && (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "h-12 justify-center px-6 text-[0.95rem] text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              Sign in
            </Link>
          )}
        </div>
      </motion.div>
    </section>
  );
}
