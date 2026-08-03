"use client";

import Link from "next/link";
import Image from "next/image";
import { Users, Lock, Globe, Film, Play } from "lucide-react";
import type { RoomSummary } from "@dimovie/shared";
import { getVideoPreview } from "@dimovie/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoomCardProps {
  room: RoomSummary;
  className?: string;
}

const privacyIcons = {
  PUBLIC: Globe,
  PRIVATE: Lock,
  PASSWORD: Lock,
};

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
  const Icon = privacyIcons[room.privacy];
  const { title, thumbnail } = getRoomPreview(room);
  const isPublic = room.privacy === "PUBLIC";
  const hasVideo = !!room.videoSource?.url;

  return (
    <Link
      href={`/room/${room.roomCode}`}
      className={cn(
        "card-hover-glow group relative flex w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-lg bg-[#181818]",
        className,
      )}
    >
      {/* Video preview */}
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-[#2f2f2f] to-[#141414]">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={title}
            fill
            unoptimized
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : hasVideo ? (
          <div className="flex h-full items-center justify-center">
            <Film className="size-12 text-white/20" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Film className="size-10 text-white/20" />
            <p className="text-xs text-white/40">Waiting for video</p>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#e50914]/90 shadow-lg">
              <Play className="ml-0.5 size-5 fill-white text-white" />
            </div>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {hasVideo && room.participantCount > 0 && (
            <Badge className="border-0 bg-[#e50914] text-[10px] font-bold uppercase tracking-wide">
              Live
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="border-0 bg-black/60 text-[10px] text-white/90"
          >
            <Icon className="mr-1 size-3" />
            {room.privacy}
          </Badge>
        </div>
      </div>

      {/* Room info */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="line-clamp-1 text-sm font-bold text-white">{title}</h3>
          <p className="mt-0.5 text-xs text-white/50">
            Hosted by {room.owner.displayName}
          </p>
        </div>

        {room.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-white/70">
            {room.description}
          </p>
        )}

        {isPublic && room.rules && (
          <div className="rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#e50914]">
              House rules
            </p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/60">
              {room.rules}
            </p>
          </div>
        )}

        <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-white/45">
          <Users className="size-3" />
          {room.participantCount}/{room.maxUsers} watching
        </p>
      </div>
    </Link>
  );
}
