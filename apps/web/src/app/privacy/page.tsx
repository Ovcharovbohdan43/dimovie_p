import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/legal-document";
import { privacyPolicy } from "@/lib/legal/privacy";
import { LEGAL_META } from "@/lib/legal/meta";

export const metadata: Metadata = {
  title: `Privacy Policy — ${LEGAL_META.productName}`,
  description: privacyPolicy.description,
};

export default function PrivacyPage() {
  return <LegalDocumentView document={privacyPolicy} />;
}
