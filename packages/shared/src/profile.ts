import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(32).optional(),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  subscription: "FREE" | "PRO" | "ENTERPRISE";
  createdAt: string;
}

export interface WatchHistoryItem {
  id: string;
  title: string;
  thumbnail: string | null;
  videoUrl: string | null;
  watchedAt: string;
  duration: number;
  roomId: string | null;
}
