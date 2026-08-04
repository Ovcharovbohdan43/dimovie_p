import type { ChatMessagePayload } from "@dimovie/shared";

export function createSystemChatNotice(
  roomId: string,
  content: string,
): ChatMessagePayload {
  return {
    id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    userId: "system",
    displayName: "System",
    content,
    createdAt: new Date().toISOString(),
    kind: "system",
  };
}

export function describeSyncEvent(
  event: "PLAY" | "PAUSE" | "SEEK",
  actorName: string,
): string {
  if (event === "PLAY") return `${actorName} resumed the video`;
  if (event === "PAUSE") return `${actorName} paused the video`;
  return `${actorName} seeked the video`;
}
