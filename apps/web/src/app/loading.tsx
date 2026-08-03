import { LoadingScreen } from "@/components/ui/loading-spinner";

export default function Loading() {
  return (
    <LoadingScreen
      message="Loading DiMovie..."
      className="min-h-screen bg-[#0b0b0f]"
    />
  );
}
