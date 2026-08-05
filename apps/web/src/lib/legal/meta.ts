export const LEGAL_META = {
  productName: "DiMovie",
  operatorName: "DiMovie",
  websiteUrl: "https://dimovie.app",
  supportEmail: "support@dimovie.app",
  privacyEmail: "privacy@dimovie.app",
  legalEmail: "legal@dimovie.app",
  /** ISO date shown on legal pages */
  effectiveDate: "2026-08-05",
  effectiveDateLabel: "August 5, 2026",
  lastUpdatedLabel: "August 5, 2026",
  governingLaw: "the laws of England and Wales",
  disputeVenue: "the courts of England and Wales",
} as const;

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: {
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }[];
};

export type LegalDocument = {
  slug: "privacy" | "terms" | "cookies";
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
};
