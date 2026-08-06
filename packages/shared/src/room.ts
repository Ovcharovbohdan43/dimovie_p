import { z } from "zod";
import type { PlanCapabilities, RoomBranding } from "./subscription.js";

export const RoomPrivacy = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
  PASSWORD: "PASSWORD",
} as const;

export type RoomPrivacy = (typeof RoomPrivacy)[keyof typeof RoomPrivacy];

export const VideoSourceType = {
  EMBED: "EMBED",
  UPLOAD: "UPLOAD",
} as const;

export type VideoSourceType =
  (typeof VideoSourceType)[keyof typeof VideoSourceType];

export const createRoomSchema = z.object({
  privacy: z.enum(["PUBLIC", "PRIVATE", "PASSWORD"]).default("PUBLIC"),
  password: z.string().min(4).max(64).optional(),
  maxUsers: z.number().int().min(2).max(500).default(100),
  description: z.string().max(500).optional(),
  rules: z.string().max(1000).optional(),
  /** ISO datetime — when the watch party is planned to start. */
  scheduledStartsAt: z.string().datetime().optional().nullable(),
});

export const setVideoSchema = z.object({
  type: z.enum(["EMBED", "UPLOAD"]),
  url: z.string().url(),
  metadata: z.record(z.unknown()).optional(),
});

export const joinRoomSchema = z.object({
  password: z.string().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type SetVideoInput = z.infer<typeof setVideoSchema>;

export const updateRoomScheduleSchema = z.object({
  /** Pass null to clear the schedule. */
  scheduledStartsAt: z.string().datetime().nullable(),
});

export type UpdateRoomScheduleInput = z.infer<typeof updateRoomScheduleSchema>;
export const updateRoomBrandingSchema = z.object({
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  logoUrl: z.string().url().optional(),
  displayTitle: z.string().min(1).max(80).optional(),
});

export type UpdateRoomBrandingInput = z.infer<typeof updateRoomBrandingSchema>;

export const ParticipantRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type ParticipantRoleType =
  (typeof ParticipantRole)[keyof typeof ParticipantRole];

/** Democratic playback — any joined participant may play / pause / seek. */
export function canControlPlayback(role: string): boolean {
  return (
    role === ParticipantRole.OWNER ||
    role === ParticipantRole.ADMIN ||
    role === ParticipantRole.MEMBER
  );
}

export const setParticipantRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type SetParticipantRoleInput = z.infer<typeof setParticipantRoleSchema>;

export interface RoomParticipant {
  userId: string;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
}

export interface RoomSummary {
  id: string;
  roomCode: string;
  privacy: RoomPrivacy;
  status: string;
  maxUsers: number;
  participantCount: number;
  /** Live Socket.IO presence count (discovery feed). */
  liveViewers?: number;
  /** Hybrid discovery score from the API ranker. */
  discoverScore?: number;
  description?: string;
  rules?: string;
  owner: { id: string; displayName: string };
  videoSource?: {
    type: VideoSourceType;
    url: string;
    metadata?: Record<string, unknown>;
  };
  planFeatures?: PlanCapabilities;
  branding?: RoomBranding;
  createdAt: string;
  lastActivityAt?: string;
  /** Planned start time (ISO). Powers "Starting soon" rail. */
  scheduledStartsAt?: string | null;
}

/** Public guest preview — no auth, no playable stream URLs */
export interface RoomPreview {
  roomCode: string;
  privacy: RoomPrivacy;
  participantCount: number;
  maxUsers: number;
  description?: string;
  rules?: string;
  owner: { displayName: string };
  requiresPassword: boolean;
  scheduledStartsAt?: string | null;
  videoPreview?: {
    title?: string;
    thumbnail?: string;
    provider?: string;
  };
}

/**
 * Guest watch payload — playable for open rooms; password rooms unlock via POST.
 * Guests can watch + receive sync; chat/voice/create require a full account.
 */
export interface GuestWatchRoom {
  room: RoomSummary;
  syncState: {
    isPlaying: boolean;
    time: number;
    version: number;
    playbackRate: number;
    serverTs: number;
    by?: string | null;
  } | null;
  mode: "guest";
}
