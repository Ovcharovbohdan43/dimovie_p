export const COOKIE_CONSENT_STORAGE_KEY = "dimovie_cookie_consent_v1";

export type CookieCategoryId =
  | "necessary"
  | "functional"
  | "analytics"
  | "marketing";

export type CookiePreferences = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type CookieConsentRecord = {
  version: 1;
  decidedAt: string;
  preferences: CookiePreferences;
};

export const DEFAULT_COOKIE_PREFERENCES: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

export const ACCEPT_ALL_PREFERENCES: CookiePreferences = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

export const REJECT_NON_ESSENTIAL_PREFERENCES: CookiePreferences = {
  ...DEFAULT_COOKIE_PREFERENCES,
};

export function isCookieConsentRecord(
  value: unknown,
): value is CookieConsentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as CookieConsentRecord;
  if (record.version !== 1 || typeof record.decidedAt !== "string") {
    return false;
  }
  const prefs = record.preferences;
  if (!prefs || typeof prefs !== "object") return false;
  return (
    prefs.necessary === true &&
    typeof prefs.functional === "boolean" &&
    typeof prefs.analytics === "boolean" &&
    typeof prefs.marketing === "boolean"
  );
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCookieConsentRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(
  preferences: CookiePreferences,
): CookieConsentRecord {
  const record: CookieConsentRecord = {
    version: 1,
    decidedAt: new Date().toISOString(),
    preferences: {
      necessary: true,
      functional: preferences.functional,
      analytics: preferences.analytics,
      marketing: preferences.marketing,
    },
  };
  window.localStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify(record),
  );
  window.dispatchEvent(
    new CustomEvent("dimovie:cookie-consent", { detail: record }),
  );
  return record;
}

export function clearCookieConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("dimovie:cookie-consent", { detail: null }));
}

/** Gate for optional scripts — call before loading analytics/marketing tags. */
export function hasConsentFor(category: Exclude<CookieCategoryId, "necessary">) {
  const consent = readCookieConsent();
  if (!consent) return false;
  return consent.preferences[category] === true;
}
