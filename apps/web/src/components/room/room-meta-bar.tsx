"use client";

import { Clock3, Users } from "lucide-react";
import type { RoomParticipant, RoomSummary } from "@dimovie/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoomAnalyticsPanel } from "@/components/room/room-analytics-panel";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/home/marks";

interface RoomMetaBarProps {
  room: RoomSummary;
  participants: RoomParticipant[];
  participantCount: number;
  watchSeconds?: number;
  showAnalytics?: boolean;
  className?: string;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function RoomMetaBar({
  room,
  participants,
  participantCount,
  watchSeconds = 0,
  showAnalytics = false,
  className,
}: RoomMetaBarProps) {
  const meta = room.videoSource?.metadata as { title?: string } | undefined;
  const title =
    room.branding?.displayTitle ?? meta?.title ?? `Room ${room.roomCode}`;
  const isLive = room.status === "ACTIVE" && !!room.videoSource?.url;
  const privacy =
    room.privacy === "PUBLIC"
      ? "Public"
      : room.privacy === "PASSWORD"
        ? "Locked"
        : "Private";

  return (
    <div className={cn("mb-3 sm:mb-4", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 text-[#ff6b73]">
                <LiveDot className="text-[#e50914]" />
                Live
              </span>
            ) : (
              <span>Lobby</span>
            )}
            <span className="text-white/25">·</span>
            <span>{privacy}</span>
            <span className="text-white/25">·</span>
            <span className="font-mono tracking-widest text-white/55">
              {room.roomCode}
            </span>
          </div>

          <h2 className="line-clamp-2 font-sans text-lg font-semibold tracking-[-0.03em] text-white sm:text-xl md:text-2xl">
            {title}
          </h2>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/50">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Avatar className="size-6 shrink-0 rounded-full">
                <AvatarFallback className="bg-white/10 text-[9px] font-semibold text-white">
                  {initials(room.owner.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                <span className="text-white/35">Host </span>
                <span className="font-semibold text-white/80">
                  {room.owner.displayName}
                </span>
              </span>
            </span>

            <span
              title={`${participantCount} viewers`}
              className="inline-flex items-center gap-1.5 tabular-nums text-white/75"
            >
              <Users className="size-3.5 text-white/40" />
              {participantCount}
            </span>

            <span
              title="Session time"
              className="inline-flex items-center gap-1.5 tabular-nums text-white/75"
            >
              <Clock3 className="size-3.5 text-white/40" />
              {formatDuration(watchSeconds)}
            </span>
          </div>

          {room.description ? (
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-white/45">
              {room.description}
            </p>
          ) : null}

          {showAnalytics ? (
            <div className="mt-3">
              <RoomAnalyticsPanel roomId={room.id} />
            </div>
          ) : null}
        </div>

        {participants.length > 0 ? (
          <div className="flex shrink-0 -space-x-2 pt-1">
            {participants.slice(0, 4).map((p) => (
              <Avatar
                key={p.userId}
                className="size-8 rounded-full ring-2 ring-[#050508] sm:size-9"
                title={p.displayName}
              >
                <AvatarFallback className="bg-white/10 text-[10px] font-semibold text-white">
                  {initials(p.displayName)}
                </AvatarFallback>
              </Avatar>
            ))}
            {participants.length > 4 ? (
              <span className="grid size-8 place-items-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70 ring-2 ring-[#050508] sm:size-9">
                +{participants.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
