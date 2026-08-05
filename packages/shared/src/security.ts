/** Platform protection & anti-abuse constants (shared client/server). */

/** Max room creates per user per minute. */
export const ROOM_CREATE_LIMIT = 5;
export const ROOM_CREATE_WINDOW_SEC = 60;

/** Max chat messages per user in the sliding window. */
export const CHAT_BURST_LIMIT = 20;
export const CHAT_BURST_WINDOW_SEC = 10;

/** Auth attempt caps (IP). */
export const AUTH_LOGIN_LIMIT = 10;
export const AUTH_LOGIN_WINDOW_SEC = 900;
export const AUTH_REGISTER_LIMIT = 5;
export const AUTH_REGISTER_WINDOW_SEC = 60;

/** Trust score bounds (100 = fully trusted). */
export const TRUST_SCORE_DEFAULT = 100;
export const TRUST_SCORE_CAPTCHA = 45;
export const TRUST_SCORE_SOFT_BLOCK = 20;

/** WebSocket connection / event caps. */
export const WS_MAX_CONNECTIONS_PER_IP = 25;
export const WS_MAX_CONNECTIONS_PER_USER = 8;
export const WS_MAX_EVENTS_PER_SEC = 30;
export const WS_GUEST_MAX_PER_IP = 12;

/** Inactive room retention before automatic cleanup. */
export const ROOM_INACTIVE_CLEANUP_DAYS = 7;

/** Length of newly generated room codes (existing short codes remain valid). */
export const ROOM_CODE_LENGTH = 10;

export const SECURITY_ERROR_CODES = {
  RATE_LIMITED: "RATE_LIMITED",
  CAPTCHA_REQUIRED: "CAPTCHA_REQUIRED",
  TRUST_BLOCKED: "TRUST_BLOCKED",
  GUEST_FORBIDDEN: "GUEST_FORBIDDEN",
  ORIGIN_REJECTED: "ORIGIN_REJECTED",
} as const;

export type SecurityErrorCode =
  (typeof SECURITY_ERROR_CODES)[keyof typeof SECURITY_ERROR_CODES];

export interface SecurityChallengeStatus {
  captchaRequired: boolean;
  siteKey: string | null;
  trustScore: number;
  reason?: string;
}

export interface CaptchaVerifyBody {
  captchaToken?: string;
}
