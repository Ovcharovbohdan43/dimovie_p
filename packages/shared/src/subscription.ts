export interface SubscriptionPlan {
  id: "FREE" | "PRO" | "ENTERPRISE";
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year" | null;
  maxUsers: number;
  maxRooms: number;
  features: string[];
}

export interface SubscriptionStatus {
  tier: "FREE" | "PRO" | "ENTERPRISE";
  active: boolean;
  endsAt: string | null;
  stripeCustomerId: string | null;
}

export interface PlanCapabilities {
  maxUsers: number;
  maxRooms: number;
  maxVideoQuality: "720p" | "1080p";
  syncDriftThresholdMs: number;
  voiceMode: "p2p" | "sfu";
  maxVoicePeers: number;
  enhancedVoice: boolean;
  watchHistory: boolean;
  roomAnalytics: boolean;
  advancedAnalytics: boolean;
  customBranding: boolean;
  prioritySync: boolean;
}

export interface RoomBranding {
  accentColor?: string;
  logoUrl?: string;
  displayTitle?: string;
}

/** During beta, Free accounts receive Pro capabilities for product testing. */
export const BETA_UNLOCK_PRO_FOR_FREE = true;

export const BETA_PRICING_MESSAGE =
  "We're in beta — every account gets Pro features for free while we learn what works for you.";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    currency: "USD",
    interval: null,
    maxUsers: 10,
    maxRooms: 3,
    features: ["10 viewers per room", "720p sync", "Text chat", "Basic voice"],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 9.99,
    currency: "USD",
    interval: "month",
    maxUsers: 100,
    maxRooms: 50,
    features: [
      "100 viewers per room",
      "Ultra-low latency sync",
      "SFU voice quality",
      "Watch history",
      "Room analytics",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 49.99,
    currency: "USD",
    interval: "month",
    maxUsers: 500,
    maxRooms: 999,
    features: [
      "500 viewers per room",
      "Priority infrastructure",
      "Custom branding",
      "Dedicated support",
      "Advanced analytics",
    ],
  },
];

const PLAN_CAPABILITIES: Record<
  SubscriptionPlan["id"],
  PlanCapabilities
> = {
  FREE: {
    maxUsers: 10,
    maxRooms: 3,
    maxVideoQuality: "720p",
    syncDriftThresholdMs: 1500,
    voiceMode: "p2p",
    maxVoicePeers: 4,
    enhancedVoice: false,
    watchHistory: false,
    roomAnalytics: false,
    advancedAnalytics: false,
    customBranding: false,
    prioritySync: false,
  },
  PRO: {
    maxUsers: 100,
    maxRooms: 50,
    maxVideoQuality: "1080p",
    syncDriftThresholdMs: 300,
    voiceMode: "sfu",
    maxVoicePeers: 15,
    enhancedVoice: true,
    watchHistory: true,
    roomAnalytics: true,
    advancedAnalytics: false,
    customBranding: false,
    prioritySync: false,
  },
  ENTERPRISE: {
    maxUsers: 500,
    maxRooms: 999,
    maxVideoQuality: "1080p",
    syncDriftThresholdMs: 150,
    voiceMode: "sfu",
    maxVoicePeers: 50,
    enhancedVoice: true,
    watchHistory: true,
    roomAnalytics: true,
    advancedAnalytics: true,
    customBranding: true,
    prioritySync: true,
  },
};

export function getPlanCapabilities(
  tier: SubscriptionPlan["id"],
): PlanCapabilities {
  if (BETA_UNLOCK_PRO_FOR_FREE && tier === "FREE") {
    return { ...PLAN_CAPABILITIES.PRO };
  }
  return PLAN_CAPABILITIES[tier];
}
