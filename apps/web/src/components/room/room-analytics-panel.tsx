"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Loader2,
  MessageSquare,
  Users,
  TrendingUp,
} from "lucide-react";
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

function Stat({
  icon,
  value,
  title,
}: {
  icon: React.ReactNode;
  value: string | number;
  title: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 text-sm tabular-nums text-white/80"
    >
      <span className="text-white/45">{icon}</span>
      {value}
    </span>
  );
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
      <div className={cn("inline-flex items-center gap-1.5 text-white/40", className)}>
        <Loader2 className="size-3.5 animate-spin" />
      </div>
    );
  }

  if (analytics.isError || !analytics.data) return null;

  const data = analytics.data;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2",
        className,
      )}
    >
      <Stat
        title="Live now"
        icon={<Users className="size-3.5" />}
        value={data.currentParticipants}
      />
      <Stat
        title="Peak viewers"
        icon={<TrendingUp className="size-3.5" />}
        value={data.peakParticipants}
      />
      <Stat
        title="Sessions"
        icon={<Activity className="size-3.5" />}
        value={data.totalSessions}
      />
      <Stat
        title="Messages"
        icon={<MessageSquare className="size-3.5" />}
        value={data.totalMessages}
      />
      {data.advanced ? (
        <Stat
          title="Engagement"
          icon={<Activity className="size-3.5" />}
          value={data.advanced.engagementScore}
        />
      ) : null}
    </div>
  );
}
