"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const AUTH_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=2400&q=80";

interface CinematicShellProps {
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
  imageSrc?: string;
  imageAlt?: string;
}

export function CinematicShell({
  children,
  className,
  panelClassName,
  imageSrc = AUTH_IMAGE,
  imageAlt = "Dark cinema auditorium",
}: CinematicShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-24 sm:px-6",
        className,
      )}
    >
      <div className="absolute inset-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center scale-105"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,12,0.92)_0%,rgba(8,8,12,0.72)_45%,rgba(8,8,12,0.88)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_0%,rgba(8,8,12,0.35)_55%,#08080c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />

      <motion.div
        className={cn(
          "relative w-full max-w-md border border-white/10 bg-[#0e0e14]/82 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-8",
          panelClassName,
        )}
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
