"use client";

import Image from "next/image";
import type { RoomPreview } from "@dimovie/shared";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/home/marks";

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
        "flex h-full flex-col overflow-hidden bg-[#08080c]",
        blurred && "pointer-events-none select-none",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#08080c]/90 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-[-0.01em] text-white">
            {title}
          </p>
          <p className="text-xs text-white/40">
            {preview.roomCode} · {preview.owner.displayName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-white/55">
          <LiveDot className="text-white/35" />
          {preview.participantCount}/{preview.maxUsers}
        </div>
      </header>

      <div className="relative flex flex-1 flex-col justify-center px-4 py-6 md:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(229,9,20,0.08),transparent_50%),radial-gradient(ellipse_at_center,#14141a_0%,#08080c_72%)]"
        />

        <div className="media-frame-ltr relative mx-auto aspect-video w-full max-w-5xl">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(229,9,20,0.22),transparent_55%),linear-gradient(160deg,#1c1c24,#0e0e14)]" />
          )}
          <div className="media-edge-wash absolute inset-0" aria-hidden />
          <div className="absolute inset-0 bg-black/25" aria-hidden />
        </div>

        {(preview.description || preview.rules) && (
          <div className="relative mx-auto mt-6 max-w-5xl space-y-2 px-1 text-sm text-white/50">
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
