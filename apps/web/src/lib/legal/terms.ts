import { LEGAL_META, type LegalDocument } from "./meta";

const {
  productName,
  supportEmail,
  legalEmail,
  effectiveDateLabel,
  governingLaw,
  disputeVenue,
} = LEGAL_META;

export const termsOfUse: LegalDocument = {
  slug: "terms",
  title: "Terms of Use",
  description: `The rules that govern your use of ${productName}.`,
  intro: `These Terms of Use (“Terms”) form a binding agreement between you and ${productName} governing access to and use of our synchronized watch-party platform, websites, APIs, and related services (the “Service”). By creating an account, joining a room, or otherwise using the Service, you agree to these Terms. If you do not agree, do not use the Service.`,
  sections: [
    {
      id: "eligibility",
      title: "1. Eligibility and accounts",
      paragraphs: [
        `Effective date: ${effectiveDateLabel}.`,
        "You must be at least 13 years old (or the minimum age required in your country) and able to form a binding contract. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization.",
        "You are responsible for accurate registration information, safeguarding your credentials, and all activity under your account. Notify us promptly at " +
          supportEmail +
          " if you suspect unauthorized access.",
      ],
    },
    {
      id: "service",
      title: "2. The Service",
      paragraphs: [
        `${productName} lets users create and join watch parties, synchronize playback across participants, exchange chat messages, and optionally use voice features. Features may change, be limited by plan, or be unavailable in some regions.`,
        "We may introduce beta or experimental features. Those features are provided as-is and may be modified or withdrawn at any time.",
      ],
    },
    {
      id: "license",
      title: "3. License to use",
      paragraphs: [
        `Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for personal or internal non-commercial entertainment purposes, unless a separate commercial agreement says otherwise.`,
        "You may not copy, modify, distribute, sell, lease, reverse engineer (except to the extent permitted by law), or create derivative works of the Service or its software, except as expressly allowed.",
      ],
    },
    {
      id: "content-rights",
      title: "4. Your content and third-party media",
      subsections: [
        {
          title: "4.1 User content",
          paragraphs: [
            "You retain ownership of content you submit (for example chat messages, room titles, branding images, profile details) (“User Content”). You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, transmit, display, and process User Content solely to operate, secure, and improve the Service.",
          ],
        },
        {
          title: "4.2 Third-party video and copyright",
          paragraphs: [
            "The Service may allow you to paste links, resolve catalog metadata, embed players, or upload files you provide. You alone are responsible for ensuring that you have all rights, licenses, and permissions needed to access and share that media with your party.",
            `${productName} is a synchronization and communication tool. We do not grant you rights to films, series, or other copyrighted works. Unauthorized streaming, redistribution, or circumvention of technological protection measures may violate copyright law and these Terms.`,
          ],
        },
        {
          title: "4.3 DMCA / copyright complaints",
          paragraphs: [
            `If you believe material on the Service infringes your copyright, send a notice to ${legalEmail} with: (a) identification of the work; (b) identification of the allegedly infringing material and its location; (c) your contact information; (d) a good-faith statement; (e) a statement under penalty of perjury that you are authorized; and (f) your physical or electronic signature. We may remove or disable access to material and terminate repeat infringers where appropriate.`,
          ],
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "5. Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "Harass, threaten, stalk, or abuse other users, or share illegal, hateful, or sexually exploitative content involving minors",
        "Impersonate others, scrape the Service in bulk, or probe/scan systems without authorization",
        "Interfere with sync infrastructure, spam chat/voice, or attempt to disrupt rooms or servers",
        "Upload malware, attempt privilege escalation, or bypass rate limits, paywalls, or access controls",
        "Use the Service to commit copyright infringement or redistribute pirated media",
        "Sell, resell, or commercially exploit the Service without our written permission",
        "Violate applicable law or any third-party rights",
      ],
      subsections: [
        {
          title: "Moderation",
          paragraphs: [
            "Room hosts and moderators may remove participants or restrict features within a room. We may also investigate, remove content, suspend rooms, or suspend/terminate accounts when we reasonably believe these Terms or the law have been violated.",
          ],
        },
      ],
    },
    {
      id: "voice-chat",
      title: "6. Voice and real-time features",
      paragraphs: [
        "Voice features use peer-to-peer and/or relay infrastructure. You are responsible for what you say. Do not share sensitive personal data in chat or voice that you are not comfortable disclosing to other participants. We do not guarantee uninterrupted low-latency sync or voice quality; network conditions, device capabilities, and third-party media sources can affect the experience.",
      ],
    },
    {
      id: "subscriptions",
      title: "7. Plans, trials, and payments",
      paragraphs: [
        "Some features may require a paid plan. Prices, included features, and billing intervals are shown at purchase. Unless stated otherwise, subscriptions renew automatically until canceled through available account controls or by contacting support.",
        "Taxes may apply. Refunds are handled according to the offer terms and applicable consumer law. Failed payments may result in feature downgrade or suspension.",
      ],
    },
    {
      id: "third-parties",
      title: "8. Third-party services",
      paragraphs: [
        "The Service may integrate or link to third-party platforms (identity providers, CDNs, media hosts, payment processors). Those services are governed by their own terms and privacy policies. We are not responsible for third-party content, availability, or practices.",
      ],
    },
    {
      id: "availability",
      title: "9. Availability and changes",
      paragraphs: [
        "We strive for high availability but do not guarantee uninterrupted or error-free operation. We may modify, suspend, or discontinue any part of the Service with or without notice, including for maintenance, security, legal, or business reasons.",
      ],
    },
    {
      id: "disclaimers",
      title: "10. Disclaimers",
      paragraphs: [
        `TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” ${productName.toUpperCase()} DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE SECURE, TIMELY, OR FREE OF DEFECTS, OR THAT MEDIA YOU CHOOSE TO WATCH WILL REMAIN AVAILABLE.`,
      ],
    },
    {
      id: "liability",
      title: "11. Limitation of liability",
      paragraphs: [
        `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${productName.toUpperCase()} AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.`,
        "Our aggregate liability for all claims relating to the Service will not exceed the greater of (a) the amounts you paid us for the Service in the twelve (12) months before the claim, or (b) fifty US dollars (USD $50), except where liability cannot be limited under applicable law (including liability for death or personal injury caused by negligence, or fraud).",
      ],
    },
    {
      id: "indemnity",
      title: "12. Indemnification",
      paragraphs: [
        `You will defend and indemnify ${productName} and its affiliates against claims, damages, losses, and expenses (including reasonable legal fees) arising from your User Content, your media sources, your misuse of the Service, or your violation of these Terms or third-party rights.`,
      ],
    },
    {
      id: "termination",
      title: "13. Suspension and termination",
      paragraphs: [
        "You may stop using the Service at any time and may request account deletion as described in the Privacy Policy. We may suspend or terminate access immediately if you breach these Terms, create risk or possible legal exposure, or if we discontinue the Service. Provisions that by their nature should survive (including ownership, disclaimers, limitations, and indemnity) will survive termination.",
      ],
    },
    {
      id: "governing-law",
      title: "14. Governing law and disputes",
      paragraphs: [
        `These Terms are governed by ${governingLaw}, without regard to conflict-of-law rules. Courts located in ${disputeVenue} will have exclusive jurisdiction, except that you may have mandatory consumer protections in your country of residence that remain available.`,
        "Before filing a formal claim, please contact us so we can try to resolve the issue informally.",
      ],
    },
    {
      id: "general",
      title: "15. General",
      bullets: [
        "These Terms are the entire agreement between you and us regarding the Service and supersede prior agreements on the same subject.",
        "If any provision is unenforceable, the remainder stays in effect.",
        "Our failure to enforce a provision is not a waiver.",
        "You may not assign these Terms without our consent; we may assign them in connection with a reorganization or sale.",
        "We may update these Terms by posting a revised version. Material changes will be highlighted where appropriate. Continued use after the effective date constitutes acceptance.",
      ],
    },
    {
      id: "contact",
      title: "16. Contact",
      paragraphs: [
        `Legal: ${legalEmail}`,
        `Support: ${supportEmail}`,
      ],
    },
  ],
};
