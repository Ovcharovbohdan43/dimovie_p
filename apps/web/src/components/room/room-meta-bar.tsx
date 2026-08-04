"use client";

import type { RoomSummary } from "@dimovie/shared";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/home/marks";

interface RoomMetaBarProps {
  room: RoomSummary;
  participantCount: number;
  watchSeconds?: number;
  className?: string;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function RoomMetaBar({
  room,
  participantCount,
  watchSeconds = 0,
  className,
}: RoomMetaBarProps) {
  const meta = room.videoSource?.metadata as
    | { title?: string }
    | undefined;
  const title =
    room.branding?.displayTitle ??
    meta?.title ??
    `Room ${room.roomCode}`;
  const isLive = room.status === "ACTIVE" && !!room.videoSource?.url;

  return (
    <div
      className={cn(
        "dm-glass-soft mb-4 flex flex-col gap-3 rounded-[18px] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e50914] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              <LiveDot className="text-white" />
              Live
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Lobby
            </span>
          )}
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            {room.privacy === "PUBLIC"
              ? "Public"
              : room.privacy === "PASSWORD"
                ? "Locked"
                : "Private"}
          </span>
        </div>
        <h2 className="truncate font-sans text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
          {title}
        </h2>
        {room.description ? (
          <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-white/50">
            {room.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Watching
          </p>
          <p className="mt-0.5 font-semibold tabular-nums text-white/85">
            {participantCount}
            <span className="text-white/35"> / {room.maxUsers}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Session
          </p>
          <p className="mt-0.5 font-semibold tabular-nums text-white/85">
            {formatDuration(watchSeconds)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Host
          </p>
          <p className="mt-0.5 truncate font-semibold text-white/85">
            {room.owner.displayName}
          </p>
        </div>
      </div>
    </div>
  );
}
