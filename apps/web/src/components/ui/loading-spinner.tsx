import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-4 border-[1.5px]",
  md: "size-8 border-2",
  lg: "size-10 border-2",
} as const;

interface LoadingSpinnerProps {
  size?: keyof typeof sizes;
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = "md",
  className,
  label = "Loading",
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "spinner-smooth rounded-full border-[#e50914]/20 border-t-[#e50914]",
        sizes[size],
        className,
      )}
    />
  );
}

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({
  message = "Loading...",
  className,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-5 overflow-hidden bg-[#08080c]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(229,9,20,0.12),transparent_55%)]"
      />
      <div className="relative flex flex-col items-center gap-4">
        <p className="font-display text-2xl font-bold tracking-[-0.04em] text-[#e50914]">
          DiMovie
        </p>
        <LoadingSpinner size="md" />
        <p className="text-sm text-white/50">{message}</p>
      </div>
    </div>
  );
}
