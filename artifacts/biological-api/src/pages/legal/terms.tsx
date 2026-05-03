import { LegalPageShell } from "@/components/legal-page-shell";
import { TermsContent } from "@/components/legal/terms-content";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" document="tos">
      <TermsContent />
    </LegalPageShell>
  );
}
