"use client";

import { cn } from "@/lib/utils";

export interface LiveReaction {
  id: string;
  emoji: string;
  displayName: string;
  lane: number;
}

export interface LiveComment {
  id: string;
  displayName: string;
  content: string;
}

interface PlayerLiveOverlayProps {
  reactions: LiveReaction[];
  comments: LiveComment[];
  className?: string;
}

export function PlayerLiveOverlay({
  reactions,
  comments,
  className,
}: PlayerLiveOverlayProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      {/* Comments — left band, transparent pills */}
      <div className="absolute bottom-[4.75rem] left-2 z-10 flex w-[min(44%,15rem)] max-w-full flex-col-reverse gap-1.5 sm:left-3 sm:w-[min(40%,17rem)]">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="live-comment-pill min-w-0 rounded-2xl bg-black/40 px-2.5 py-1.5 ring-1 ring-white/[0.08] backdrop-blur-sm sm:px-3 sm:py-2"
          >
            <p className="line-clamp-3 break-words text-[11px] leading-snug text-white/75 [overflow-wrap:anywhere] sm:text-xs">
              <span className="font-semibold text-white">
                {comment.displayName}
              </span>{" "}
              {comment.content}
            </p>
          </div>
        ))}
      </div>

      {/* Reactions — right edge, float upward */}
      <div className="absolute bottom-[4.75rem] right-1.5 z-10 h-[min(50%,240px)] w-12 sm:right-2.5">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="live-reaction-float absolute bottom-0 flex size-9 items-center justify-center text-[1.65rem] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:size-10 sm:text-3xl"
            style={{ right: `${reaction.lane * 5}px` }}
            title={reaction.displayName}
          >
            <span className="select-none">{reaction.emoji}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
