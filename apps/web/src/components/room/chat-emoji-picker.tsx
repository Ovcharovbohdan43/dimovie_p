"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Smile } from "lucide-react";
import { Theme, EmojiStyle, Categories } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { cn } from "@/lib/utils";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-[min(288px,calc(100vw-1.5rem))] items-center justify-center rounded-xl bg-[#1c1c1c] text-sm text-white/40">
      Loading emojis...
    </div>
  ),
});

const QUICK_REACTIONS = ["😂", "❤️", "🔥", "👏", "😮", "🎬"];
const PICKER_WIDTH = 288;
const PICKER_HEIGHT = 360;

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
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const placePanel = () => {
    const trigger = rootRef.current?.querySelector("button");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PICKER_WIDTH, window.innerWidth - 16);
    const height = Math.min(PICKER_HEIGHT, window.innerHeight - 24);
    let left = rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = rect.top - height - 8;
    if (top < 8) {
      top = Math.min(rect.bottom + 8, window.innerHeight - height - 8);
    }
    setCoords({ top, left, width, height });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placePanel();
    const onReposition = () => placePanel();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleEmojiClick = (data: EmojiClickData) => {
    onInsert(data.emoji);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[80] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-white/10 bg-[#121218] shadow-2xl shadow-black/50"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.DARK}
              emojiStyle={EmojiStyle.NATIVE}
              width={coords.width}
              height={coords.height}
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
          </div>,
          document.body,
        )}

      <div className={cn("flex items-center gap-1", !iconOnly && "mb-2.5")}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open emoji picker"
          aria-expanded={open}
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
