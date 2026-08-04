"use client";

import { motion, useReducedMotion } from "motion/react";

const lines = [
  { label: "Sync lag", value: "<500ms" },
  { label: "Room size", value: "Up to 500" },
  { label: "Control", value: "Anyone can seek" },
] as const;

export function SyncStrip() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-14">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <motion.div
        className="mx-auto max-w-5xl text-center"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="font-display text-[clamp(1.85rem,4.5vw,3rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
          Built like a streamer.
          <span className="block text-white/55">Feels like the same couch.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[42ch] text-sm leading-relaxed text-white/60 md:text-base">
          Server-authoritative playback keeps every client honest — so the laugh
          lands on the same frame for everyone in the room.
        </p>
      </motion.div>

      <motion.ul
        className="mx-auto mt-12 grid max-w-4xl gap-px bg-white/10 sm:grid-cols-3"
        initial={reduceMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "-10% 0px" }}
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: reduceMotion ? 0 : 0.1 },
          },
        }}
      >
        {lines.map((item) => (
          <motion.li
            key={item.label}
            className="bg-[#08080c] px-6 py-8 text-center"
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          >
            <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
              {item.value}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
              {item.label}
            </p>
          </motion.li>
        ))}
      </motion.ul>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </section>
  );
}
