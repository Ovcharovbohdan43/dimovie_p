"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { RailArrow } from "@/components/home/marks";

interface ContentRowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ContentRow({ title, children, className }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [updateEdges, children]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.82, 720);
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section
      className={cn(
        "group/row relative px-4 sm:px-6 md:px-10 lg:px-14",
        className,
      )}
    >
      <div className="mb-4 flex items-end justify-between gap-4 md:mb-6">
        <h2 className="font-sans text-xl font-semibold tracking-[-0.03em] text-white md:text-2xl">
          {title}
        </h2>
        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            aria-label="Scroll left"
            disabled={!canLeft}
            onClick={() => scroll("left")}
            className="dm-btn-neutral grid size-9 place-items-center rounded-xl disabled:opacity-25"
          >
            <RailArrow direction="left" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            disabled={!canRight}
            onClick={() => scroll("right")}
            className="dm-btn-neutral grid size-9 place-items-center rounded-xl disabled:opacity-25"
          >
            <RailArrow direction="right" className="size-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-[#050508] to-transparent transition-opacity sm:w-12",
            canLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-[#050508] to-transparent transition-opacity sm:w-12",
            canRight ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={scrollRef}
          className="scrollbar-hide flex snap-x snap-mandatory items-start gap-4 overflow-x-auto overflow-y-visible pb-2"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
