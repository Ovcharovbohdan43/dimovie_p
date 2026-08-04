export const SyncEvent = {
  PLAY: "PLAY",
  PAUSE: "PAUSE",
  SEEK: "SEEK",
  TIME_UPDATE: "TIME_UPDATE",
} as const;

export type SyncEventType = (typeof SyncEvent)[keyof typeof SyncEvent];

export interface SyncIntentPayload {
  event: SyncEventType;
  time: number;
  clientTs: number;
}

export interface SyncStatePayload {
  isPlaying: boolean;
  time: number;
  version: number;
  serverTs: number;
  by: string | null;
  playbackRate: number;
}

export interface TimeUpdatePayload {
  time: number;
  serverTs: number;
  isPlaying: boolean;
}

export interface RoomClosedPayload {
  message: string;
}

export const WS_ROOM_EVENTS = {
  JOIN: "room:join",
  LEAVE: "room:leave",
  JOINED: "room:joined",
  PARTICIPANTS: "room:participants",
  REMOVED: "room:removed",
  CLOSED: "room:closed",
  ERROR: "room:error",
  SYNC_INTENT: "sync:intent",
  SYNC_STATE: "sync:state",
  TIME_UPDATE: "sync:time_update",
  CHAT_MESSAGE: "chat:message",
  CHAT_DELETE: "chat:delete",
  CHAT_COOLDOWN: "chat:cooldown",
  REACTION: "reaction:emit",
  VOICE_SIGNAL: "voice:signal",
  VOICE_JOIN: "voice:join",
  VOICE_LEAVE: "voice:leave",
  VOICE_PEERS: "voice:peers",
  /** PCM fallback when WebRTC ICE/TURN cannot traverse NAT */
  VOICE_AUDIO: "voice:audio",
} as const;
