"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

const steps = [
  {
    index: "01",
    title: "Open a room",
    copy: "Pick a title, drop a link or upload, set the vibe. Your party starts in seconds — no setup maze.",
    image:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1600&q=80",
    alt: "Projector light cutting through a dark theater",
  },
  {
    index: "02",
    title: "Share one code",
    copy: "Friends join from phone or laptop with a short room code. Private, password, or open — your call.",
    image:
      "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=1600&q=80",
    alt: "Popcorn and soft light in a cinema seat",
  },
  {
    index: "03",
    title: "Stay locked in",
    copy: "Play, pause, seek — everyone moves together. Voice and live chat ride alongside the frame.",
    image:
      "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1600&q=80",
    alt: "Cinema screen glowing in a dark auditorium",
  },
] as const;

export function ExperienceStory() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative space-y-14 px-4 py-6 sm:space-y-20 sm:px-6 md:px-10 lg:px-14 lg:py-10">
      <motion.div
        className="max-w-2xl"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00a8e1]">
          The night, in three beats
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
          From empty room to shared frame
        </h2>
      </motion.div>

      <div className="space-y-16 md:space-y-24">
        {steps.map((step, i) => {
          const reverse = i % 2 === 1;
          return (
            <motion.article
              key={step.index}
              className="grid items-center gap-6 md:grid-cols-12 md:gap-8 lg:gap-12"
              initial={reduceMotion ? false : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{
                duration: 0.7,
                delay: reduceMotion ? 0 : 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className={cnStoryMedia(reverse)}>
                <div
                  className={
                    reverse
                      ? "media-frame-rtl relative aspect-[16/10] md:aspect-[16/9]"
                      : "media-frame-ltr relative aspect-[16/10] md:aspect-[16/9]"
                  }
                >
                  <Image
                    src={step.image}
                    alt={step.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 58vw"
                    className="object-cover transition duration-700 ease-out will-change-transform hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden
                    className={
                      reverse
                        ? "media-edge-wash media-edge-wash-rtl absolute inset-0"
                        : "media-edge-wash absolute inset-0"
                    }
                  />
                </div>
              </div>

              <div
                className={cnStoryCopy(reverse)}
              >
                <p className="font-display text-sm font-semibold tracking-[0.2em] text-[#e50914]">
                  {step.index}
                </p>
                <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.02em] text-white md:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-white/65 md:text-base">
                  {step.copy}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

function cnStoryMedia(reverse: boolean) {
  return reverse
    ? "md:col-span-7 md:col-start-6 md:row-start-1"
    : "md:col-span-7";
}

function cnStoryCopy(reverse: boolean) {
  return reverse
    ? "md:col-span-4 md:col-start-1 md:row-start-1 md:pr-2"
    : "md:col-span-4 md:col-start-9";
}
