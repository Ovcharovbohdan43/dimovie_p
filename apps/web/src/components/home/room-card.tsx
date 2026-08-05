"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import type { RoomSummary } from "@dimovie/shared";
import { getVideoPreview } from "@dimovie/shared";
import { cn } from "@/lib/utils";
import { LiveDot, PlayMark } from "@/components/home/marks";

interface RoomCardProps {
  room: RoomSummary;
  className?: string;
}

const DESC_CLAMP_LINES = 2;

function getRoomPreview(room: RoomSummary) {
  const meta = room.videoSource?.metadata as
    | { title?: string; thumbnail?: string; provider?: string }
    | undefined;

  const title =
    room.branding?.displayTitle ?? meta?.title ?? `Room ${room.roomCode}`;
  let thumbnail = meta?.thumbnail;

  if (!thumbnail && room.videoSource?.url) {
    thumbnail = getVideoPreview(room.videoSource.url).thumbnailUrl;
  }

  return { title, thumbnail };
}

function privacyLabel(privacy: string) {
  if (privacy === "PUBLIC") return "Public";
  if (privacy === "PASSWORD") return "Locked";
  return "Private";
}

function DescriptionBlock({
  text,
  expanded,
  onToggle,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const measureRef = useRef<HTMLParagraphElement>(null);
  const [needsMore, setNeedsMore] = useState(false);

  const measure = useCallback(() => {
    const el = measureRef.current;
    if (!el) return;
    const wasClamped = el.classList.contains("line-clamp-2");
    el.classList.remove("line-clamp-2");
    const fullHeight = el.scrollHeight;
    el.classList.add("line-clamp-2");
    const clampedHeight = el.clientHeight;
    if (!wasClamped && expanded) {
      el.classList.remove("line-clamp-2");
    }
    setNeedsMore(fullHeight > clampedHeight + 1);
  }, [expanded]);

  useLayoutEffect(() => {
    measure();
  }, [text, measure]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="flex min-h-[3.25rem] flex-col">
      <motion.div
        initial={false}
        animate={{
          height: expanded ? "auto" : `${DESC_CLAMP_LINES * 1.625}rem`,
        }}
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.7 }}
        className="overflow-hidden"
      >
        <p
          ref={measureRef}
          className={cn(
            "text-xs leading-relaxed text-white/55",
            !expanded && "line-clamp-2",
          )}
        >
          {text}
        </p>
      </motion.div>

      <AnimatePresence initial={false}>
        {needsMore ? (
          <motion.button
            key="more"
            type="button"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
            className="mt-1.5 self-start text-[11px] font-semibold tracking-[-0.01em] text-[#9ec9ea] transition hover:text-white"
          >
            {expanded ? "Show less" : "More"}
          </motion.button>
        ) : (
          // Reserve space so cards without a long description stay the same height.
          <span className="mt-1.5 block h-[1.125rem]" aria-hidden />
        )}
      </AnimatePresence>
    </div>
  );
}

export function RoomCard({ room, className }: RoomCardProps) {
  const { title, thumbnail } = getRoomPreview(room);
  const hasVideo = !!room.videoSource?.url;
  const isLive = hasVideo && room.participantCount > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={cn(
        "w-[72vw] max-w-[300px] flex-shrink-0 snap-start self-start sm:w-[260px] md:w-[280px] lg:w-[300px]",
        expanded && "relative z-20",
        className,
      )}
      whileHover={{ y: expanded ? 0 : -4 }}
      transition={{
        layout: { type: "spring", stiffness: 340, damping: 30, mass: 0.8 },
        y: { type: "spring", stiffness: 420, damping: 28 },
      }}
    >
      <Link
        href={`/room/${room.roomCode}`}
        className="dm-card group relative flex h-full min-h-[318px] flex-col outline-none ring-offset-2 ring-offset-[#050508] focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[#1a1a22]">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              unoptimized
              sizes="(max-width: 640px) 72vw, 300px"
              className="object-cover transition duration-500 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(91,159,212,0.18),transparent_55%),linear-gradient(160deg,#1c1c26,#0a0a10)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />

          {hasVideo && (
            <div className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
              <span className="grid size-12 place-items-center rounded-[14px] bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                <PlayMark className="ml-0.5 size-4" />
              </span>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e50914] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                <LiveDot className="text-white" />
                Live
              </span>
            )}
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md">
              {privacyLabel(room.privacy)}
            </span>
          </div>

          <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/90 backdrop-blur-md">
            {room.participantCount}/{room.maxUsers}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-4 py-4">
          <h3 className="line-clamp-1 min-h-[1.35rem] font-sans text-[15px] font-semibold tracking-[-0.02em] text-white">
            {title}
          </h3>
          <p className="min-h-[1rem] text-xs text-white/45">
            {room.owner.displayName}
            <span className="mx-1.5 text-white/20">·</span>
            {room.participantCount} watching
          </p>

          {room.description?.trim() ? (
            <DescriptionBlock
              text={room.description.trim()}
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
            />
          ) : (
            // Keep empty-description cards the same footprint.
            <div className="min-h-[3.25rem]" aria-hidden>
              <div className="h-[2.5rem]" />
              <span className="mt-1.5 block h-[1.125rem]" />
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
