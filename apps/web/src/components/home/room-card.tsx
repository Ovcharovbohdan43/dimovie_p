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

  const title = meta?.title ?? `Room ${room.roomCode}`;
  let thumbnail = meta?.thumbnail;

  if (!thumbnail && room.videoSource?.url) {
    thumbnail = getVideoPreview(room.videoSource.url).thumbnailUrl;
  }

  return { title, thumbnail };
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
        className="group relative block overflow-hidden bg-[#121218] outline-none ring-offset-2 ring-offset-[#08080c] focus-visible:ring-2 focus-visible:ring-[#e50914]"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-[#1a1a22]">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              unoptimized
              sizes="(max-width: 640px) 72vw, 300px"
              className="object-cover transition duration-500 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(229,9,20,0.22),transparent_55%),linear-gradient(160deg,#1c1c24,#0e0e14)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/20" />

          {hasVideo && (
            <div className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
              <span className="grid size-11 place-items-center bg-[#e50914] text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                <PlayMark className="ml-0.5 size-4" />
              </span>
            </div>
          )}

          <div className="absolute left-2.5 top-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 bg-[#e50914] px-2 py-1">
                <LiveDot className="text-white" />
                Live
              </span>
            )}
            <span className="bg-black/55 px-2 py-1 backdrop-blur-sm">
              {room.privacy}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 px-3.5 py-3.5">
          <h3 className="line-clamp-1 font-display text-sm font-semibold tracking-[-0.01em] text-white">
            {title}
          </h3>
          <p className="text-xs text-white/50">
            {room.owner.displayName}
            <span className="mx-1.5 text-white/25">·</span>
            {room.participantCount}/{room.maxUsers}
          </p>
          {room.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-white/65">
              {room.description}
            </p>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
