"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  RevealCopy,
  RevealEyebrow,
  RevealHeadline,
} from "@/components/home/text-reveal";

const beats = [
  {
    title: "Your stage, not a feed",
    copy: "Create a room, name the night, and keep every open party in one row — live counts, privacy, and what you’re watching at a glance.",
    image: "/landing/dashboard.png",
    alt: "DiMovie dashboard showing active watch party rooms",
  },
  {
    title: "One code. Everyone lands.",
    copy: "Share a short room link. Friends join from phone or laptop — public, private, or password — without installing anything.",
    image: "/landing/share-code.png",
    alt: "DiMovie join screen with a room code and party preview",
  },
  {
    title: "Frame-locked with voice + chat",
    copy: "Playback stays under 500ms. Voice rides beside the cut. Chat stays loud enough to feel the room — without covering the picture.",
    image: "/landing/voice-sync.png",
    alt: "DiMovie watch party with video, voice dock, and live chat",
  },
] as const;

export function ProductProof() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative px-4 py-8 sm:px-6 md:px-10 md:py-12 lg:px-14">
      <motion.div
        className="max-w-2xl"
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00a8e1]">
          Real product, real rooms
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.55rem,5vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
          Built around the night you actually throw
        </h2>
        <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-white/60 md:text-base">
          DiMovie is the room: sync, voice, chat, and a host stage — not another
          cinema stock collage. Here’s the interface you’ll open with friends.
        </p>
      </motion.div>

      <div className="mt-10 space-y-14 sm:mt-12 md:mt-16 md:space-y-24">
        {beats.map((beat, i) => {
          const reverse = i % 2 === 1;
          return (
            <article
              key={beat.title}
              className="grid items-center gap-5 sm:gap-6 md:grid-cols-12 md:gap-10"
            >
              <div
                className={
                  reverse
                    ? "md:col-span-7 md:col-start-6 md:row-start-1"
                    : "md:col-span-7"
                }
              >
                <div className="relative aspect-[16/11] overflow-hidden rounded-[4px] sm:aspect-[16/10] md:aspect-[16/9]">
                  <Image
                    src={beat.image}
                    alt={beat.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 58vw"
                    className="object-cover object-top"
                  />
                  <div
                    aria-hidden
                    className={
                      reverse
                        ? "pointer-events-none absolute inset-0 bg-[linear-gradient(270deg,rgba(8,8,12,0.55)_0%,transparent_38%)]"
                        : "pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,12,0.55)_0%,transparent_38%)]"
                    }
                  />
                </div>
              </div>

              <div
                className={
                  reverse
                    ? "md:col-span-4 md:col-start-1 md:row-start-1"
                    : "md:col-span-4 md:col-start-9"
                }
              >
                <RevealEyebrow className="font-display text-sm font-semibold tracking-[0.18em] text-[#e50914]">
                  {String(i + 1).padStart(2, "0")}
                </RevealEyebrow>
                <RevealHeadline
                  text={beat.title}
                  className="mt-2 font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-white sm:mt-3 sm:text-2xl md:text-3xl"
                />
                <RevealCopy className="mt-2 max-w-[36ch] text-sm leading-relaxed text-white/65 sm:mt-3 md:text-base">
                  {beat.copy}
                </RevealCopy>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
