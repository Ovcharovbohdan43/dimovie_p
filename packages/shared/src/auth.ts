import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(32),
  captchaToken: z.string().max(2048).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().max(2048).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  subscription: "FREE" | "PRO" | "ENTERPRISE";
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}
