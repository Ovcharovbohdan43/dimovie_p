import { cn } from "@/lib/utils";

/** DiMovie mark: solid D with play cutout — matches favicon. */
export function DiMovieMark({
  className,
  title = "DiMovie",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M11 7h23c14.36 0 26 11.64 26 26S48.36 59 34 59H11V7zm19.5 15.25v19.5L45.75 32 30.5 22.25z"
      />
    </svg>
  );
}

export function DiMovieLogo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
  color = "#e50914",
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
  color?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      style={{ color }}
    >
      <DiMovieMark className={cn("size-7", markClassName)} />
      {showWordmark ? (
        <span
          className={cn(
            "font-display text-xl font-bold tracking-[-0.04em] sm:text-2xl",
            wordmarkClassName,
          )}
        >
          DiMovie
        </span>
      ) : null}
    </span>
  );
}
