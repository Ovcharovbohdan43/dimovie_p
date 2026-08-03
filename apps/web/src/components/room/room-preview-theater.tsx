"use client";

import Image from "next/image";
import { Film, Users } from "lucide-react";
import type { RoomPreview } from "@dimovie/shared";
import { cn } from "@/lib/utils";

interface RoomPreviewTheaterProps {
  preview: RoomPreview;
  blurred?: boolean;
  className?: string;
}

export function RoomPreviewTheater({
  preview,
  blurred = false,
  className,
}: RoomPreviewTheaterProps) {
  const title = preview.videoPreview?.title ?? "Watch Party";
  const thumbnail = preview.videoPreview?.thumbnail;

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-[#0b0b0f]",
        blurred && "pointer-events-none select-none",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#141414]/90 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-white/40">
            {preview.roomCode} · {preview.owner.displayName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/50">
          <Users className="size-3.5" />
          {preview.participantCount}/{preview.maxUsers}
        </div>
      </header>

      <div className="flex flex-1 flex-col justify-center bg-[radial-gradient(ellipse_at_center,_#1a1a1f_0%,_#0b0b0f_70%)] px-4 py-6 md:px-8">
        <div className="relative mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black ring-1 ring-white/[0.06]">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              className="object-cover opacity-80"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film className="size-16 text-white/15" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {(preview.description || preview.rules) && (
          <div className="mx-auto mt-6 max-w-5xl space-y-2 px-1 text-sm text-white/50">
            {preview.description && <p>{preview.description}</p>}
            {preview.rules && (
              <p className="text-white/35">Rules: {preview.rules}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
