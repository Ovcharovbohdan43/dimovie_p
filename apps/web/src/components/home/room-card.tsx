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
import { motion } from "motion/react";
import type { RoomSummary } from "@dimovie/shared";
import { getVideoPreview, isUpcomingSchedule } from "@dimovie/shared";
import { cn } from "@/lib/utils";
import { LiveDot, PlayMark } from "@/components/home/marks";
import { formatScheduleLabel } from "@/lib/datetime-local";

interface RoomCardProps {
  room: RoomSummary;
  className?: string;
}

/** Collapsed description = 2 lines of text-xs leading-relaxed + More row. */
const DESC_TEXT_H = "h-[2.625rem]"; // 2 × 1.3125rem
const DESC_ACTION_H = "h-5"; // More / spacer
const DESC_SLOT_H = "h-[3.75rem]"; // text + gap + action

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

function DescriptionSlot({
  text,
  expanded,
  onToggle,
}: {
  text: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const measureRef = useRef<HTMLParagraphElement>(null);
  const [needsMore, setNeedsMore] = useState(false);

  const measure = useCallback(() => {
    const el = measureRef.current;
    if (!el || !text) {
      setNeedsMore(false);
      return;
    }
    el.classList.remove("line-clamp-2");
    const fullHeight = el.scrollHeight;
    el.classList.add("line-clamp-2");
    const clampedHeight = el.clientHeight;
    if (expanded) el.classList.remove("line-clamp-2");
    setNeedsMore(fullHeight > clampedHeight + 1);
  }, [text, expanded]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1.5",
        expanded ? "min-h-[3.75rem]" : DESC_SLOT_H,
      )}
    >
      <div
        className={cn(
          "overflow-hidden",
          expanded ? "h-auto" : DESC_TEXT_H,
        )}
      >
        {text ? (
          <p
            ref={measureRef}
            className={cn(
              "text-xs leading-relaxed text-white/55",
              !expanded && "line-clamp-2",
            )}
          >
            {text}
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-transparent" aria-hidden>
            &nbsp;
            <br />
            &nbsp;
          </p>
        )}
      </div>

      <div className={cn("flex items-center", DESC_ACTION_H)}>
        {text && needsMore ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
            className="text-[11px] font-semibold tracking-[-0.01em] text-[#9ec9ea] transition hover:text-white"
          >
            {expanded ? "Show less" : "More"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function RoomCard({ room, className }: RoomCardProps) {
  const { title, thumbnail } = getRoomPreview(room);
  const hasVideo = !!room.videoSource?.url;
  const watching = room.liveViewers ?? room.participantCount;
  const upcoming = isUpcomingSchedule(room.scheduledStartsAt);
  const isLive = hasVideo && watching > 0 && !upcoming;
  const description = room.description?.trim() || null;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={cn(
        "w-[72vw] max-w-[300px] flex-shrink-0 snap-start self-start sm:w-[260px] md:w-[280px] lg:w-[300px]",
        // Fixed collapsed height so empty / filled cards align.
        !expanded && "h-[338px]",
        expanded && "relative z-20 min-h-[338px]",
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
        className="dm-card group relative flex h-full flex-col outline-none ring-offset-2 ring-offset-[#050508] focus-visible:ring-2 focus-visible:ring-white/40"
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
            {upcoming && room.scheduledStartsAt && (
              <span className="rounded-full bg-[#1a3a52] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ec9ea] backdrop-blur-md">
                {formatScheduleLabel(room.scheduledStartsAt)}
              </span>
            )}
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md">
              {privacyLabel(room.privacy)}
            </span>
          </div>

          <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/90 backdrop-blur-md">
            {watching}/{room.maxUsers}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-4">
          <h3 className="line-clamp-1 h-[1.35rem] font-sans text-[15px] font-semibold tracking-[-0.02em] text-white">
            {title}
          </h3>
          <p className="h-4 truncate text-xs text-white/45">
            {room.owner.displayName}
            <span className="mx-1.5 text-white/20">·</span>
            {watching} watching
          </p>

          <div className="mt-auto">
            <DescriptionSlot
              text={description}
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
