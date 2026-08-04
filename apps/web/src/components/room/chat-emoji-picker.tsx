"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Smile } from "lucide-react";
import { Theme, EmojiStyle, Categories } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { cn } from "@/lib/utils";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-[320px] items-center justify-center rounded-xl bg-[#1c1c1c] text-sm text-white/40">
      Loading emojis...
    </div>
  ),
});

const QUICK_REACTIONS = ["😂", "❤️", "🔥", "👏", "😮", "🎬"];

interface ChatEmojiPickerProps {
  onInsert: (emoji: string) => void;
  onReaction: (emoji: string) => void;
  className?: string;
  /** When true, only the smile trigger is shown (parent owns quick reactions). */
  iconOnly?: boolean;
}

export function ChatEmojiPicker({
  onInsert,
  onReaction,
  className,
  iconOnly = false,
}: ChatEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleEmojiClick = (data: EmojiClickData) => {
    onInsert(data.emoji);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.NATIVE}
            width={320}
            height={400}
            searchPlaceHolder="Search emoji..."
            previewConfig={{ showPreview: false }}
            lazyLoadEmojis
            categories={[
              { category: Categories.SUGGESTED, name: "Recent" },
              { category: Categories.SMILEYS_PEOPLE, name: "Smileys" },
              { category: Categories.ANIMALS_NATURE, name: "Nature" },
              { category: Categories.FOOD_DRINK, name: "Food" },
              { category: Categories.TRAVEL_PLACES, name: "Travel" },
              { category: Categories.ACTIVITIES, name: "Activities" },
              { category: Categories.OBJECTS, name: "Objects" },
              { category: Categories.SYMBOLS, name: "Symbols" },
              { category: Categories.FLAGS, name: "Flags" },
            ]}
          />
        </div>
      )}

      <div className={cn("flex items-center gap-1", !iconOnly && "mb-2.5")}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open emoji picker"
          className={cn(
            "flex size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-xl transition",
            open
              ? "bg-white/15 text-white"
              : "bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white",
          )}
        >
          <Smile className="size-4" />
        </button>

        {!iconOnly && (
          <>
            <div className="mx-1 h-5 w-px bg-white/10" />
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaction(emoji)}
                title="Send reaction"
                className="flex size-9 shrink-0 cursor-pointer select-none items-center justify-center rounded-xl bg-white/[0.04] text-lg transition hover:scale-110 hover:bg-white/10 active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
