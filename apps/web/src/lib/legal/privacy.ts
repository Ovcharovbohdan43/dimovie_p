import { LEGAL_META, type LegalDocument } from "./meta";

const { productName, privacyEmail, supportEmail, effectiveDateLabel } =
  LEGAL_META;

export const privacyPolicy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  description: `How ${productName} collects, uses, and protects your personal data.`,
  intro: `This Privacy Policy explains how ${productName} (“we”, “us”, or “our”) collects, uses, shares, and protects personal information when you use our synchronized watch-party service, websites, and related applications (collectively, the “Service”). It is informed by the EU General Data Protection Regulation (GDPR), the UK GDPR, and common transparency practices used by consumer entertainment platforms.`,
  sections: [
    {
      id: "who-we-are",
      title: "1. Who we are",
      paragraphs: [
        `${productName} operates an online platform that lets people create and join watch parties, synchronize video playback, chat in real time, and use optional voice features.`,
        `For questions about this Policy or your personal data, contact us at ${privacyEmail}. General support: ${supportEmail}.`,
        `Effective date: ${effectiveDateLabel}.`,
      ],
    },
    {
      id: "scope",
      title: "2. Scope",
      paragraphs: [
        "This Policy applies to personal data we process when you:",
      ],
      bullets: [
        "Create an account, sign in, or authenticate via supported providers (for example Google or Discord)",
        "Browse public pages, dashboards, pricing, or join a room by code or link",
        "Use chat, voice, room settings, uploads, catalog lookups, or analytics shown to hosts",
        "Contact us or otherwise communicate with us about the Service",
      ],
    },
    {
      id: "data-we-collect",
      title: "3. Information we collect",
      subsections: [
        {
          title: "3.1 Account and profile data",
          paragraphs: [
            "When you register or update a profile, we may process:",
          ],
          bullets: [
            "Email address, display name, and password credentials (passwords are stored hashed)",
            "Avatar or profile fields you choose to provide",
            "OAuth identifiers and basic profile information from identity providers you connect",
            "Subscription or plan status if billing features are enabled",
          ],
        },
        {
          title: "3.2 Watch-party and usage data",
          paragraphs: [
            "To run rooms and keep playback in sync, we process:",
          ],
          bullets: [
            "Room metadata (title, privacy mode, invite codes, optional password hashes, branding, rules)",
            "Participation events (join/leave, roles, moderation actions such as kick or ban)",
            "Playback sync signals (play, pause, seek, media source references)",
            "Chat messages and emoji reactions you send in a room",
            "Voice-session signaling metadata needed for WebRTC (not the content of your conversation itself stored as a recording by default)",
            "Optional host-facing room analytics (for example concurrent viewers or engagement metrics)",
          ],
        },
        {
          title: "3.3 Technical and device data",
          bullets: [
            "IP address, approximate location derived from IP, browser type, device type, and operating system",
            "Timestamps, request logs, error diagnostics, and performance metrics",
            "Cookies, local storage tokens, and similar technologies as described in our Cookie Policy",
          ],
        },
        {
          title: "3.4 Media and third-party content references",
          paragraphs: [
            "If you provide a video URL, upload a file, or resolve catalog metadata, we process the references and technical metadata needed to play or proxy that media. We do not claim ownership of third-party titles you choose to watch. You are responsible for ensuring you have the right to access that content.",
          ],
        },
        {
          title: "3.5 Information from third parties",
          paragraphs: [
            "Identity providers may share limited account details when you sign in with them. Payment processors (if/when billing is active) process payment data under their own policies; we typically receive confirmation of payment status rather than full card numbers.",
          ],
        },
      ],
    },
    {
      id: "purposes",
      title: "4. How we use personal data",
      paragraphs: [
        "We use personal data for the following purposes:",
      ],
      bullets: [
        "Provide, operate, and secure the Service (accounts, rooms, sync, chat, voice signaling)",
        "Authenticate users, maintain sessions, and prevent fraud or abuse",
        "Personalize room experience and remember settings you choose",
        "Communicate service notices, security alerts, and (with consent where required) product updates",
        "Measure reliability, debug issues, and improve product quality",
        "Comply with legal obligations and enforce our Terms of Use",
      ],
    },
    {
      id: "legal-bases",
      title: "5. Legal bases (EEA/UK)",
      paragraphs: [
        "Where GDPR / UK GDPR applies, we rely on one or more of these bases:",
      ],
      bullets: [
        "Contract — processing needed to provide the Service you request (account, rooms, sync)",
        "Legitimate interests — securing the platform, preventing abuse, improving reliability, in ways that do not override your rights",
        "Consent — non-essential cookies/analytics/marketing, and other optional processing we clearly ask for",
        "Legal obligation — when we must retain or disclose data to comply with law",
      ],
    },
    {
      id: "sharing",
      title: "6. How we share information",
      paragraphs: [
        "We do not sell your personal information. We may share data with:",
      ],
      bullets: [
        "Other participants in a room — display name, avatar, chat messages, presence, and moderation-visible roles",
        "Infrastructure providers — hosting, databases, Redis, object storage/CDN, email delivery, error monitoring",
        "Identity and payment providers — only as needed for login or billing",
        "Authorities or advisors — when required by law, or to protect rights, safety, and the integrity of the Service",
        "Successors — in connection with a merger, acquisition, or asset transfer, subject to appropriate safeguards",
      ],
      subsections: [
        {
          title: "Room visibility",
          paragraphs: [
            "Public rooms and their metadata may be discoverable to other users. Password-protected or private rooms limit join access, but participants inside a room can still see each other’s messages and presence for that session.",
          ],
        },
      ],
    },
    {
      id: "international",
      title: "7. International transfers",
      paragraphs: [
        "We may process data in countries other than where you live. When we transfer personal data from the EEA/UK to a country without an adequacy decision, we use appropriate safeguards such as Standard Contractual Clauses (SCCs) or equivalent mechanisms, together with technical and organizational measures.",
      ],
    },
    {
      id: "retention",
      title: "8. Retention",
      paragraphs: [
        "We keep personal data only as long as needed for the purposes above, including:",
      ],
      bullets: [
        "Account data — while your account remains active, and for a limited period afterward for security, disputes, or legal compliance",
        "Chat and room activity — for the life of the room/session and any short operational retention needed for moderation and reliability",
        "Logs and diagnostics — typically for a limited rolling window unless needed longer for security investigations",
        "Billing records — for periods required by tax and accounting rules when applicable",
      ],
      subsections: [
        {
          title: "Deletion",
          paragraphs: [
            `You may request account deletion via ${privacyEmail} or in-product controls when available. Some residual copies may remain in encrypted backups for a limited time, and we may retain information needed to resolve disputes or comply with law.`,
          ],
        },
      ],
    },
    {
      id: "security",
      title: "9. Security",
      paragraphs: [
        "We use industry-standard measures appropriate to the risk, including encrypted transport (HTTPS/TLS), access controls, hashed passwords, and least-privilege practices for production systems. No method of transmission or storage is completely secure; please use a strong unique password and protect your devices.",
      ],
    },
    {
      id: "rights",
      title: "10. Your rights",
      paragraphs: [
        "Depending on your location, you may have rights to:",
      ],
      bullets: [
        "Access the personal data we hold about you",
        "Correct inaccurate or incomplete data",
        "Erase data in certain circumstances (“right to be forgotten”)",
        "Restrict or object to certain processing",
        "Receive a portable copy of data you provided",
        "Withdraw consent where processing is based on consent",
        "Lodge a complaint with a supervisory authority",
      ],
      subsections: [
        {
          title: "How to exercise rights",
          paragraphs: [
            `Email ${privacyEmail} with enough detail to verify your request. We will respond within the timeframes required by applicable law. California residents may have additional rights under the CCPA/CPRA (including the right to know, delete, and opt out of “sale”/“sharing” as those terms are defined — we do not sell personal information).`,
          ],
        },
      ],
    },
    {
      id: "children",
      title: "11. Children",
      paragraphs: [
        `The Service is not directed to children under 13 (or the higher age of digital consent in your country). We do not knowingly collect personal data from children. If you believe a child has provided us personal data, contact ${privacyEmail} and we will take appropriate steps to delete it.`,
      ],
    },
    {
      id: "automated",
      title: "12. Automated decision-making",
      paragraphs: [
        "We do not use personal data for automated decision-making that produces legal or similarly significant effects about you without human involvement.",
      ],
    },
    {
      id: "changes",
      title: "13. Changes to this Policy",
      paragraphs: [
        "We may update this Privacy Policy from time to time. We will change the “Last updated” date and, for material changes, provide additional notice (for example an in-product notice or email) where appropriate. Continued use of the Service after the effective date of changes means you acknowledge the updated Policy.",
      ],
    },
    {
      id: "contact",
      title: "14. Contact",
      paragraphs: [
        `Privacy requests: ${privacyEmail}`,
        `Support: ${supportEmail}`,
      ],
    },
  ],
};
