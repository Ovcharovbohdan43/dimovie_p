/** Geometric marks — no lucide / generic AI icon set */

export function PlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M7.5 4.8v14.4L19.2 12 7.5 4.8z" />
    </svg>
  );
}

export function PauseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
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

export function PlusMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="square" />
    </svg>
  );
}

export function BackMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <path d="M15 5L8 12l7 7" strokeLinecap="square" />
    </svg>
  );
}

export function PeopleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.5 19c.6-3.2 2.9-5 6.5-5s5.9 1.8 6.5 5" strokeLinecap="round" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M15 19c.35-1.7 1.4-3 3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function ShareMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" strokeLinecap="round" />
    </svg>
  );
}

export function MicMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" strokeLinecap="round" />
    </svg>
  );
}
