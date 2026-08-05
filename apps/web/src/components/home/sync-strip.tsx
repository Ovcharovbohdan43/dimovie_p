"use client";

import { motion, useReducedMotion } from "motion/react";

const lines = [
  {
    label: "Sync lag",
    value: "<500ms",
    note: "Server-authoritative playhead — pause and seek land together.",
  },
  {
    label: "In the room",
    value: "Voice + chat",
    note: "Talk over the cut without leaving the player or losing the frame.",
  },
  {
    label: "Join path",
    value: "One link",
    note: "Short room code. Phone or laptop. Public, private, or password.",
  },
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
          What the room actually does
        </h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-sm leading-relaxed text-white/60 md:text-base">
          Not a theater poster. DiMovie keeps playback honest, keeps the
          conversation next to the picture, and gets friends in without a setup
          maze.
        </p>
      </motion.div>

      <motion.ul
        className="mx-auto mt-12 grid max-w-5xl gap-px bg-white/10 sm:grid-cols-3"
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
            className="bg-[#08080c] px-6 py-8 text-left sm:text-center"
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
            <p className="mx-auto mt-3 max-w-[28ch] text-sm leading-relaxed text-white/55">
              {item.note}
            </p>
          </motion.li>
        ))}
      </motion.ul>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </section>
  );
}
