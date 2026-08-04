/** Geometric marks — no lucide / generic AI icon set */

export function PlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M7.5 4.8v14.4L19.2 12 7.5 4.8z" />
    </svg>
  );
}

export function RailArrow({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      aria-hidden
      className={className}
    >
      {direction === "left" ? (
        <path d="M15 5L8 12l7 7" />
      ) : (
        <path d="M9 5l7 7-7 7" />
      )}
    </svg>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-block",
        width: "0.45em",
        height: "0.45em",
        borderRadius: 1,
        background: "currentColor",
      }}
    />
  );
}
