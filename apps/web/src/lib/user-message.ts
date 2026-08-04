/**
 * Maps technical / Nest / network errors to short user-facing copy.
 */
const EXACT: Record<string, string> = {
  "Invalid credentials": "Wrong email or password. Check them and try again.",
  "Wrong email or password. Check them and try again.":
    "Wrong email or password. Check them and try again.",
  "Email already registered":
    "This email is already registered. Sign in or use another email.",
  "This email is already registered. Sign in or use another email.":
    "This email is already registered. Sign in or use another email.",
  "Too many login attempts": "Too many tries. Wait a minute, then try again.",
  "Too many tries. Wait a minute, then try again.":
    "Too many tries. Wait a minute, then try again.",
  "Missing refresh token": "Your session expired. Please sign in again.",
  "Invalid refresh token": "Your session expired. Please sign in again.",
  "Missing token": "Please sign in to continue.",
  "Invalid user": "Please sign in again to continue.",
  Unauthorized: "Please sign in to continue.",
  "Room not found": "This room doesn’t exist or the link is no longer valid.",
  "Password required": "This room needs a password.",
  "Invalid password": "That password isn’t right. Try again.",
  "You are blocked by the host":
    "The host blocked you — you can’t join their rooms.",
  "You are banned from this room":
    "You’ve been banned from this room and can’t join.",
  "Room is full": "This room is full. Try again later or ask the host.",
  "Only owner can set video": "Only the host can change the video.",
  "Only owner can close room": "Only the host can close the room.",
  "Only owner can kick participants": "Only the host can remove people.",
  "Only owner can ban users": "Only the host can ban people.",
  "Only owner can assign roles": "Only the host can change roles.",
  "Only owner can update branding": "Only the host can edit room branding.",
  "Only owner can view analytics": "Only the host can view room stats.",
  "Cannot kick yourself": "You can’t remove yourself from the room.",
  "Cannot ban yourself": "You can’t ban yourself.",
  "Cannot change host role": "The host role can’t be changed.",
  "Participant not found": "That person is no longer in the room.",
  "User not found": "We couldn’t find that account.",
  "Empty message": "Write something before sending.",
  "Not a participant": "Join the room first to chat and watch together.",
  "Chat error": "Message couldn’t be sent. Try again.",
  "Catalog not loaded": "Load the title first, then pick an episode.",
  "No stream qualities found": "No playable quality found for this title.",
  "Catalog page not recognized":
    "We couldn’t read that link. Double-check it and try again.",
  "This resource is not supported":
    "This link isn’t supported yet. Try another title.",
  "Link must point to a .html page":
    "Use a direct page link to the movie or series.",
  "Catalog post id missing":
    "We couldn’t read that link. Double-check it and try again.",
  "No voice tracks found on this page":
    "No audio tracks found for this title.",
  "Season and episode required for series":
    "Pick a season and episode to continue.",
  "Stream not available for this selection":
    "Playback isn’t available for that choice. Try another.",
  "Invalid stream URL": "That stream link looks invalid. Try again.",
  "Empty stream body": "The video stream came back empty. Try again.",
  "Custom branding requires Enterprise plan":
    "Custom branding is available on the Enterprise plan.",
  "Room analytics requires Pro plan or higher":
    "Room stats are available on Pro and higher.",
  "Stripe not configured":
    "Billing isn’t available right now. Try again later.",
  "No active subscription": "You don’t have an active subscription.",
  "Invalid webhook": "Payment update failed. Please try again later.",
  "Voice channel is full for this plan":
    "Voice chat is full for this plan. Upgrade or try later.",
  "Voice connection failed":
    "Couldn’t connect voice. Check your mic and try again.",
  "Microphone access denied":
    "Microphone access is blocked. Allow it in browser settings.",
  "Failed to start playback": "Couldn’t start the video. Try again.",
  "Failed to load video. Try refreshing the page.":
    "The video didn’t load. Refresh the page or try another link.",
  "Could not join room": "Couldn’t join the room. Check the code and try again.",
  "Room not found or link is invalid":
    "This room doesn’t exist or the link is no longer valid.",
  "The host ended the stream": "The host ended the watch party.",
  "API is temporarily unavailable. Wait a few seconds and refresh the page.":
    "DiMovie is taking a short break. Wait a moment and try again.",
  "fetchApi: unreachable":
    "DiMovie is taking a short break. Wait a moment and try again.",
  "Internal Server Error":
    "Something went wrong on our side. Please try again in a moment.",
  "Bad Gateway": "DiMovie is taking a short break. Wait a moment and try again.",
  "Service Unavailable":
    "DiMovie is taking a short break. Wait a moment and try again.",
  "Gateway Timeout":
    "That’s taking longer than usual. Please try again.",
};

const PATTERNS: Array<[RegExp, string]> = [
  [
    /failed to fetch|networkerror|load failed|fetch failed|econnrefused|enotfound|etimedout|network request failed/i,
    "Can’t reach DiMovie right now. Check your connection and try again.",
  ],
  [
    /api is temporarily unavailable|temporarily unavailable/i,
    "DiMovie is taking a short break. Wait a moment and try again.",
  ],
  [
    /too many.*(request|login|attempt)/i,
    "Too many tries. Wait a minute, then try again.",
  ],
  [
    /email.*(already|exists|registered)/i,
    "This email is already registered. Sign in or use another email.",
  ],
  [
    /invalid credentials|wrong password|unauthorized/i,
    "Wrong email or password. Check them and try again.",
  ],
  [
    /password.*(required|incorrect|invalid)/i,
    "That password isn’t right. Try again.",
  ],
  [
    /room.*(not found|does not exist|invalid)/i,
    "This room doesn’t exist or the link is no longer valid.",
  ],
  [
    /room is full|max users/i,
    "This room is full. Try again later or ask the host.",
  ],
  [
    /banned|blocked/i,
    "You can’t join this room right now.",
  ],
  [
    /stripe|price id|billing/i,
    "Billing isn’t available right now. Try again later.",
  ],
  [
    /stream proxy failed|playwright|catalog browser unavailable/i,
    "We couldn’t open that title right now. Try again in a moment.",
  ],
  [
    /for these links, use the/i,
    "For these links, use the “Your resource link” section below.",
  ],
  [
    /validation failed|must be|should not be empty|expected/i,
    "Check the form fields and try again.",
  ],
  [
    /internal server error|status code 5\d\d|http 5\d\d/i,
    "Something went wrong on our side. Please try again in a moment.",
  ],
];

function statusFallback(status?: number): string | null {
  if (status === undefined || status === null) return null;
  if (status === 0) {
    return "Can’t reach DiMovie right now. Check your connection and try again.";
  }
  if (status === 400) return "Check the form fields and try again.";
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You don’t have access to do that.";
  if (status === 404) return "We couldn’t find what you’re looking for.";
  if (status === 409) return "That action conflicts with the current state. Try again.";
  if (status === 429) return "Too many tries. Wait a minute, then try again.";
  if (status >= 500) {
    return "DiMovie is taking a short break. Wait a moment and try again.";
  }
  return null;
}

export function toUserMessage(
  raw?: string | string[] | null,
  status?: number,
): string {
  const joined = Array.isArray(raw) ? raw.join(", ") : (raw ?? "");
  const text = joined.trim();

  if (text) {
    const exact = EXACT[text];
    if (exact) return exact;

    for (const [pattern, message] of PATTERNS) {
      if (pattern.test(text)) return message;
    }

    // Nest often returns already-readable sentences — keep if not technical jargon
    const looksTechnical =
      /exception|stack|errno|econn|sql|prisma|nestjs|undefined|null is not|cannot read|statusText|fetchApi|proxy failed \(\d+\)/i.test(
        text,
      );

    if (!looksTechnical && text.length <= 140) {
      return text;
    }
  }

  return (
    statusFallback(status) ??
    "Something went wrong. Please try again in a moment."
  );
}
