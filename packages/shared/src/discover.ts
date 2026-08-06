/**
 * Hybrid discovery ranking for public watch parties.
 * Combines live presence, content readiness, social size, and recency
 * with owner diversity (MMR-style) so one host doesn't flood the feed.
 */

export type DiscoverableRoom = {
  id: string;
  roomCode: string;
  ownerId: string;
  participantCount: number;
  liveViewers: number;
  hasVideo: boolean;
  createdAtMs: number;
  lastActivityAtMs: number;
  scheduledStartsAtMs?: number | null;
};

export type RankedDiscoverRoom<T> = T & {
  discoverScore: number;
  liveViewers: number;
};

const HALF_LIFE_MS = 6 * 60 * 60 * 1000; // 6h activity half-life
/** Upcoming schedules beyond this window leave "Starting soon". */
export const SCHEDULE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

function activityDecay(lastActivityAtMs: number, now: number): number {
  const age = Math.max(0, now - lastActivityAtMs);
  return Math.exp(-age / HALF_LIFE_MS);
}

export function isUpcomingSchedule(
  scheduledStartsAt: string | number | Date | null | undefined,
  now = Date.now(),
  windowMs = SCHEDULE_SOON_WINDOW_MS,
): boolean {
  if (scheduledStartsAt == null || scheduledStartsAt === "") return false;
  const t =
    typeof scheduledStartsAt === "number"
      ? scheduledStartsAt
      : scheduledStartsAt instanceof Date
        ? scheduledStartsAt.getTime()
        : Date.parse(scheduledStartsAt);
  if (!Number.isFinite(t)) return false;
  return t > now && t - now <= windowMs;
}

/** Raw relevance before diversity re-ranking. */
export function scoreDiscoverRoom(
  room: DiscoverableRoom,
  now = Date.now(),
): number {
  const live = Math.max(0, room.liveViewers);
  const joined = Math.max(0, room.participantCount);
  const decay = activityDecay(room.lastActivityAtMs || room.createdAtMs, now);

  // Weights tuned for watch-party UX: live > ready video > crowd > freshness
  const liveScore = Math.log1p(live) * 12;
  const crowdScore = Math.log1p(joined) * 3.5;
  const videoBoost = room.hasVideo ? 8 : 0;
  const liveWithVideo = live > 0 && room.hasVideo ? 10 : 0;
  const freshness = decay * 6;

  let scheduleBoost = 0;
  if (
    room.scheduledStartsAtMs != null &&
    isUpcomingSchedule(room.scheduledStartsAtMs, now)
  ) {
    const hoursUntil = (room.scheduledStartsAtMs - now) / (60 * 60 * 1000);
    // Soonest starts rank higher within the scheduled bucket / overall feed
    scheduleBoost = Math.max(0, 8 - hoursUntil * 0.35);
  }

  return liveScore + crowdScore + videoBoost + liveWithVideo + freshness + scheduleBoost;
}

/**
 * Maximal Marginal Relevance–style pick: high score rooms first, but
 * penalize repeating the same owner in the visible window.
 */
export function rankDiscoverRooms<T extends DiscoverableRoom>(
  rooms: T[],
  limit = 48,
  now = Date.now(),
): RankedDiscoverRoom<T>[] {
  const scored = rooms.map((room) => ({
    ...room,
    discoverScore: scoreDiscoverRoom(room, now),
  }));

  scored.sort((a, b) => b.discoverScore - a.discoverScore);

  const picked: RankedDiscoverRoom<T>[] = [];
  const ownerCounts = new Map<string, number>();
  const remaining = [...scored];

  while (picked.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const room = remaining[i]!;
      const ownerHits = ownerCounts.get(room.ownerId) ?? 0;
      // Soft diversity penalty — second room from same host ranks lower
      const diversity = 1 / (1 + ownerHits * 1.75);
      const adjusted = room.discoverScore * diversity;
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const [chosen] = remaining.splice(bestIdx, 1);
    if (!chosen) break;
    picked.push(chosen);
    ownerCounts.set(chosen.ownerId, (ownerCounts.get(chosen.ownerId) ?? 0) + 1);
  }

  return picked;
}

/** Bucket helpers for UI rails — mutually exclusive. */
export function partitionDiscoverFeed<
  T extends {
    liveViewers?: number;
    videoSource?: { url?: string };
    scheduledStartsAt?: string | null;
  },
>(rooms: T[], now = Date.now()) {
  const starting = rooms
    .filter((r) => isUpcomingSchedule(r.scheduledStartsAt, now))
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.scheduledStartsAt!) - Date.parse(b.scheduledStartsAt!),
    );

  const startingSet = new Set(starting);

  const live = rooms.filter(
    (r) =>
      !startingSet.has(r) &&
      (r.liveViewers ?? 0) > 0 &&
      !!r.videoSource?.url,
  );
  const liveSet = new Set(live);

  const discover = rooms.filter(
    (r) => !startingSet.has(r) && !liveSet.has(r),
  );

  return { live, starting, discover, fresh: discover };
}
