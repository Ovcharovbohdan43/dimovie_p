"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import type { RoomSummary } from "@dimovie/shared";
import { getVideoPreview } from "@dimovie/shared";
import { cn } from "@/lib/utils";
import { LiveDot, PlayMark } from "@/components/home/marks";

interface RoomCardProps {
  room: RoomSummary;
  className?: string;
}

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

export function RoomCard({ room, className }: RoomCardProps) {
  const { title, thumbnail } = getRoomPreview(room);
  const hasVideo = !!room.videoSource?.url;
  const isLive = hasVideo && room.participantCount > 0;

  return (
    <motion.div
      className={cn(
        "w-[72vw] max-w-[300px] flex-shrink-0 snap-start sm:w-[260px] md:w-[280px] lg:w-[300px]",
        className,
      )}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <Link
        href={`/room/${room.roomCode}`}
        className="dm-card group relative block outline-none ring-offset-2 ring-offset-[#050508] focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-[#1a1a22]">
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

        <div className="space-y-2 px-4 py-4">
          <h3 className="line-clamp-1 font-sans text-[15px] font-semibold tracking-[-0.02em] text-white">
            {title}
          </h3>
          <p className="text-xs text-white/45">
            {room.owner.displayName}
            <span className="mx-1.5 text-white/20">·</span>
            {room.participantCount} watching
          </p>
          {room.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-white/55">
              {room.description}
            </p>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
