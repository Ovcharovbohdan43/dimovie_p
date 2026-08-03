"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface ContentRowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ContentRow({ title, children, className }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className={cn("group/row relative px-4 md:px-8 lg:px-12", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white md:text-xl">{title}</h2>
        <div className="flex gap-1 opacity-0 transition group-hover/row:opacity-100">
          <button
            onClick={() => scroll("left")}
            className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-3 overflow-x-auto pb-4"
      >
        {children}
      </div>
    </section>
  );
}
