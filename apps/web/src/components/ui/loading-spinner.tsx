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
        "flex flex-col items-center justify-center gap-4",
        className,
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-[#e50914]/10 ring-1 ring-[#e50914]/20">
        <LoadingSpinner size="md" />
      </div>
      <p className="text-sm text-white/50">{message}</p>
    </div>
  );
}
