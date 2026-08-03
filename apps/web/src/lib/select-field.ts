import type { ChangeEventHandler } from "react";

/** Blur after pick so native select does not keep a blinking text caret. */
export function blurSelectOnChange<T extends HTMLSelectElement>(
  handler: ChangeEventHandler<T>,
): ChangeEventHandler<T> {
  return (event) => {
    handler(event);
    event.currentTarget.blur();
  };
}

export const catalogSelectClassName =
  "mt-1 w-full cursor-pointer select-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#e50914]/40";
