"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

const lineContainer: Variants = {
  hidden: {},
  visible: (stagger = 0.045) => ({
    transition: { staggerChildren: stagger, delayChildren: 0.06 },
  }),
};

const wordVariants: Variants = {
  hidden: {
    y: "115%",
    opacity: 0,
    filter: "blur(8px)",
  },
  visible: {
    y: "0%",
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.72,
      ease: easeOutExpo,
    },
  },
};

const blockVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: easeOutExpo, delay: 0.12 },
  },
};

/** Word-cascade reveal for headlines beside product imagery. */
export function RevealHeadline({
  text,
  className,
  as: Tag = "h3",
}: {
  text: string;
  className?: string;
  as?: "h2" | "h3" | "p";
}) {
  const reduceMotion = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);

  if (reduceMotion) {
    const Comp = Tag;
    return <Comp className={className}>{text}</Comp>;
  }

  return (
    <Tag className={cn(className)}>
      <motion.span
        className="flex flex-wrap"
        variants={lineContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.55, margin: "0px 0px -8% 0px" }}
        custom={0.05}
        aria-label={text}
      >
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="mr-[0.28em] inline-block overflow-hidden pb-[0.12em]">
            <motion.span className="inline-block will-change-transform" variants={wordVariants}>
              {word}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

/** Soft blur-rise for supporting copy beside imagery. */
export function RevealCopy({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <p className={className}>{children}</p>;
  }

  return (
    <motion.p
      className={className}
      variants={blockVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4, margin: "0px 0px -6% 0px" }}
    >
      {children}
    </motion.p>
  );
}

/** Index / eyebrow next to product shots. */
export function RevealEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <p className={className}>{children}</p>;
  }

  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, x: -12, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.55, ease: easeOutExpo }}
    >
      {children}
    </motion.p>
  );
}
