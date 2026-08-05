import { LEGAL_META, type LegalDocument } from "./meta";

const { productName, privacyEmail, effectiveDateLabel } = LEGAL_META;

export const cookiePolicy: LegalDocument = {
  slug: "cookies",
  title: "Cookie Policy",
  description: `How ${productName} uses cookies and similar technologies.`,
  intro: `This Cookie Policy explains how ${productName} uses cookies, local storage, and similar technologies on our website and application. It should be read together with our Privacy Policy. It follows common transparency practices recommended by EU/UK guidance (including ePrivacy / PECR expectations for consent to non-essential cookies).`,
  sections: [
    {
      id: "what-are-cookies",
      title: "1. What are cookies and similar technologies?",
      paragraphs: [
        `Effective date: ${effectiveDateLabel}.`,
        "Cookies are small text files stored on your device when you visit a site. We also use related technologies such as local storage and session storage to keep you signed in, remember choices, and make the Service work.",
        "Cookies may be “first-party” (set by us) or “third-party” (set by another domain). They may be “session” (expire when you close the browser) or “persistent” (remain until they expire or you delete them).",
      ],
    },
    {
      id: "why",
      title: "2. Why we use them",
      bullets: [
        "Authenticate your session and keep you signed in securely",
        "Remember cookie preferences and other settings you choose",
        "Enable core product features such as room continuity and UI state",
        "Understand performance and reliability when you allow analytics cookies",
        "Support optional marketing measurement only if you opt in",
      ],
    },
    {
      id: "categories",
      title: "3. Categories we use",
      subsections: [
        {
          title: "3.1 Strictly necessary",
          paragraphs: [
            "These are required for the Service to function and cannot be switched off in our consent tool. They include authentication/session tokens, security controls, load balancing, and storage of your cookie choice itself.",
          ],
          bullets: [
            "Auth / session tokens (cookie or local storage) — keep you signed in and authorize API requests",
            "Cookie consent record — remembers Accept / Reject / customized choices",
            "Security and CSRF-related tokens where applicable",
          ],
        },
        {
          title: "3.2 Functional",
          paragraphs: [
            "These remember choices that improve convenience (for example interface preferences). They are used only if you enable Functional cookies.",
          ],
        },
        {
          title: "3.3 Analytics",
          paragraphs: [
            "These help us understand how the product is used (for example page performance or feature adoption) so we can improve reliability. Analytics cookies load only with your consent. If no analytics vendor is currently active, enabling this category simply allows us to activate such tools later under the same preference.",
          ],
        },
        {
          title: "3.4 Marketing",
          paragraphs: [
            "These may be used to measure campaigns or personalize promotional content. Marketing cookies are off by default and load only if you opt in. We currently do not rely on advertising cookies for core watch-party features.",
          ],
        },
      ],
    },
    {
      id: "examples",
      title: "4. Examples of storage we may use",
      paragraphs: [
        "Exact names can change as we ship updates. Typical examples include:",
      ],
      bullets: [
        "dimovie_token / auth-related storage — necessary session credentials",
        "dimovie_cookie_consent_v1 — your cookie preference record",
        "Supabase / identity provider cookies — necessary when those auth flows are used",
        "Provider cookies from Google, Discord, Stripe, or analytics vendors — only when you use those flows or grant the relevant category",
      ],
    },
    {
      id: "consent",
      title: "5. Your choices",
      paragraphs: [
        "When you first visit, we show a cookie banner asking you to Accept all, Reject non-essential, or Customize categories. Strictly necessary cookies may be set regardless of banner choice because the Service cannot operate without them.",
        "You can change your mind at any time using “Cookie settings” in the site footer, or by clearing site data in your browser (which may also sign you out).",
        "Browser controls also let you block or delete cookies. Blocking necessary cookies may break sign-in, rooms, or other core features.",
      ],
    },
    {
      id: "do-not-track",
      title: "6. Global Privacy Control / Do Not Track",
      paragraphs: [
        "Some browsers offer Global Privacy Control (GPC) or Do Not Track signals. Where required by law, we treat applicable opt-out signals as a request to disable non-essential sale/share or targeted advertising cookies. Necessary cookies may still be used to operate the Service.",
      ],
    },
    {
      id: "updates",
      title: "7. Changes",
      paragraphs: [
        "We may update this Cookie Policy when our technologies or legal requirements change. The “Last updated” date will always reflect the latest version.",
      ],
    },
    {
      id: "contact",
      title: "8. Contact",
      paragraphs: [
        `Questions about cookies or privacy: ${privacyEmail}.`,
      ],
    },
  ],
};

export const COOKIE_CATEGORY_COPY: Record<
  "necessary" | "functional" | "analytics" | "marketing",
  { title: string; description: string; required?: boolean }
> = {
  necessary: {
    title: "Strictly necessary",
    description:
      "Required for sign-in, security, and remembering your cookie choice. Always on.",
    required: true,
  },
  functional: {
    title: "Functional",
    description:
      "Remembers preferences that make DiMovie easier to use across visits.",
  },
  analytics: {
    title: "Analytics",
    description:
      "Helps us understand performance and improve reliability. Used only with your OK.",
  },
  marketing: {
    title: "Marketing",
    description:
      "Optional campaign measurement and promotional cookies. Off unless you opt in.",
  },
};
