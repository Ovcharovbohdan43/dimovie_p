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

export function VolumeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4V9.5z" strokeLinejoin="round" />
      <path d="M15.2 9.2a3.2 3.2 0 010 5.6" strokeLinecap="square" />
      <path d="M17.6 6.5a6.2 6.2 0 010 11" strokeLinecap="square" />
    </svg>
  );
}

export function VolumeMuteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4V9.5z" strokeLinejoin="round" />
      <path d="M16 9l5 5M21 9l-5 5" strokeLinecap="square" />
    </svg>
  );
}

export function ExpandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="square" />
    </svg>
  );
}

export function CollapseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="square" />
    </svg>
  );
}

export function CaptionsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <rect x="3" y="6" width="18" height="12" rx="0" />
      <path d="M7 12.5h3.5M13.5 12.5H17M7 15.5h2M12 15.5h5" strokeLinecap="square" />
    </svg>
  );
}

export function SignalMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className={className}>
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
      <path d="M7.5 8.2a6.5 6.5 0 000 7.6M16.5 8.2a6.5 6.5 0 010 7.6" strokeLinecap="square" />
      <path d="M4.2 5.2a11 11 0 000 13.6M19.8 5.2a11 11 0 010 13.6" strokeLinecap="square" />
    </svg>
  );
}

export function ChevronMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
      className={className}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="square" />
    </svg>
  );
}
