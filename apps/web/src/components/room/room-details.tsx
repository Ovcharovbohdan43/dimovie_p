"use client";

import { Globe, ScrollText, User } from "lucide-react";
import type { RoomSummary } from "@dimovie/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface RoomDetailsProps {
  room: RoomSummary;
  participants: { userId: string; displayName: string; role: string }[];
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function RoomDetails({
  room,
  participants,
  className,
}: RoomDetailsProps) {
  const videoTitle =
    (room.videoSource?.metadata as { title?: string })?.title ??
    "Watch Party";

  return (
    <section
      className={cn(
        "border-t border-white/[0.06] bg-gradient-to-b from-[#141414] to-[#0b0b0f] px-4 py-5 md:px-6 lg:px-8",
        className,
      )}
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
              {videoTitle}
            </h2>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Avatar className="size-6 ring-1 ring-white/10">
                <AvatarFallback className="bg-[#2f2f2f] text-[10px] font-bold">
                  {getInitials(room.owner.displayName)}
                </AvatarFallback>
              </Avatar>
              <span>
                Hosted by{" "}
                <span className="font-medium text-white/80">
                  {room.owner.displayName}
                </span>
              </span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-xs text-white/40">
                {room.roomCode}
              </span>
            </div>
          </div>

          {participants.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {participants.slice(0, 5).map((p) => (
                  <Avatar
                    key={p.userId}
                    className="size-8 border-2 border-[#141414] ring-1 ring-white/10"
                    title={p.displayName}
                  >
                    <AvatarFallback className="bg-[#2f2f2f] text-[10px] font-semibold">
                      {getInitials(p.displayName)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {participants.length > 5 && (
                <span className="text-xs text-white/40">
                  +{participants.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        {room.description && (
          <p className="max-w-3xl text-sm leading-relaxed text-white/65">
            {room.description}
          </p>
        )}

        {room.privacy === "PUBLIC" && room.rules && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center gap-2">
              <ScrollText className="size-4 text-[#00a8e1]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00a8e1]">
                House Rules
              </h3>
              <Globe className="ml-auto size-3.5 text-white/30" />
            </div>
            <p className="text-sm leading-relaxed text-white/55">{room.rules}</p>
          </div>
        )}

        {!room.description && !room.rules && (
          <div className="flex items-center gap-2 text-xs text-white/30">
            <User className="size-3.5" />
            <span>
              {participants.length}{" "}
              {participants.length === 1 ? "viewer" : "viewers"} in this party
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
