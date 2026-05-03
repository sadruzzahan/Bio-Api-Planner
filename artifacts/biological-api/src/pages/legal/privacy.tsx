import { LegalPageShell } from "@/components/legal-page-shell";
import { PrivacyContent } from "@/components/legal/privacy-content";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" document="privacy">
      <PrivacyContent />
    </LegalPageShell>
  );
}
