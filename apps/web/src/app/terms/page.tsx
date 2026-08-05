import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/legal-document";
import { termsOfUse } from "@/lib/legal/terms";
import { LEGAL_META } from "@/lib/legal/meta";

export const metadata: Metadata = {
  title: `Terms of Use — ${LEGAL_META.productName}`,
  description: termsOfUse.description,
};

export default function TermsPage() {
  return <LegalDocumentView document={termsOfUse} />;
}
