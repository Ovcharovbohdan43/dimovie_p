import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/legal-document";
import { cookiePolicy } from "@/lib/legal/cookies";
import { LEGAL_META } from "@/lib/legal/meta";

export const metadata: Metadata = {
  title: `Cookie Policy — ${LEGAL_META.productName}`,
  description: cookiePolicy.description,
};

export default function CookiesPage() {
  return <LegalDocumentView document={cookiePolicy} />;
}
