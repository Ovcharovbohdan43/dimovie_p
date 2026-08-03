"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface RoomAnalyticsPanelProps {
  roomId: string;
  className?: string;
}

interface RoomAnalytics {
  roomCode: string;
  totalSessions: number;
  currentParticipants: number;
  peakParticipants: number;
  totalMessages: number;
  advanced?: {
    avgMessagesPerSession: number;
    engagementScore: number;
    totalReactions: number;
    priorityInfrastructure: boolean;
  };
}

export function RoomAnalyticsPanel({
  roomId,
  className,
}: RoomAnalyticsPanelProps) {
  const analytics = useQuery({
    queryKey: ["room-analytics", roomId],
    queryFn: () => api<RoomAnalytics>(`/rooms/${roomId}/analytics`),
    retry: false,
  });

  if (analytics.isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-white/50", className)}>
        <Loader2 className="size-4 animate-spin" />
        Loading analytics...
      </div>
    );
  }

  if (analytics.isError) return null;

  const data = analytics.data;
  if (!data) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.06] bg-[#141414]/80 p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <BarChart3 className="size-4 text-[#00a8e1]" />
        Room analytics
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-white/40">Live now</dt>
          <dd className="font-semibold text-white">{data.currentParticipants}</dd>
        </div>
        <div>
          <dt className="text-white/40">Peak viewers</dt>
          <dd className="font-semibold text-white">{data.peakParticipants}</dd>
        </div>
        <div>
          <dt className="text-white/40">Sessions</dt>
          <dd className="font-semibold text-white">{data.totalSessions}</dd>
        </div>
        <div>
          <dt className="text-white/40">Messages</dt>
          <dd className="font-semibold text-white">{data.totalMessages}</dd>
        </div>
      </dl>
      {data.advanced && (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-white/40">Engagement</dt>
            <dd className="font-semibold text-[#e50914]">
              {data.advanced.engagementScore}/100
            </dd>
          </div>
          <div>
            <dt className="text-white/40">Avg messages</dt>
            <dd className="font-semibold text-white">
              {data.advanced.avgMessagesPerSession}
            </dd>
          </div>
          <div>
            <dt className="text-white/40">Reactions</dt>
            <dd className="font-semibold text-white">
              {data.advanced.totalReactions}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
