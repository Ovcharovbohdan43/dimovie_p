/** Minimum seconds between chat messages for each user. */
export const CHAT_MIN_INTERVAL_MS = 5000;

/** Hard cap on chat message length (characters after trim/sanitize). */
export const CHAT_MAX_LENGTH = 200;

/** Cooldown violations within the window before a shadow ban applies. */
export const CHAT_SHADOW_VIOLATIONS = 3;

/** Window (seconds) for counting cooldown violations. */
export const CHAT_VIOLATIONS_WINDOW_SEC = 120;

/** Shadow ban duration (seconds) — messages echo only to the sender. */
export const CHAT_SHADOW_BAN_SEC = 900;

/** Shared quick-reaction strip (chat panel + emoji picker). */
export const CHAT_QUICK_REACTIONS = ["😂", "❤️", "😮", "🔥", "👏"] as const;

/** Minimum interval between floating reactions per user. */
export const REACTION_MIN_INTERVAL_MS = 800;

/** Max UTF-16 length for a reaction emoji payload. */
export const REACTION_MAX_LENGTH = 16;

/** Client-side delivery status for optimistic rows. */
export type ChatDeliveryStatus = "pending" | "sent" | "failed";

export interface ChatMessagePayload {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
  /** Client-rendered notices (join, pause, seek). Not persisted. */
  kind?: "user" | "system";
  /** Optimistic / failed send marker — client only. */
  status?: ChatDeliveryStatus;
}

export interface ChatDeletePayload {
  messageId: string;
  roomId: string;
}

export interface ChatCooldownPayload {
  waitSeconds: number;
}

export type ChatSendResult =
  | { kind: "broadcast"; message: ChatMessagePayload }
  | { kind: "shadow"; message: ChatMessagePayload }
  | { kind: "cooldown"; waitSeconds: number };

/** Reject plain text / markup abuse while allowing emoji (incl. ZWJ sequences). */
export function isValidReactionEmoji(emoji: string): boolean {
  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > REACTION_MAX_LENGTH) return false;
  if (/[A-Za-z0-9<>{}[\]\\/_=]/.test(trimmed)) return false;
  return true;
}
