import { LegalPageShell } from "@/components/legal-page-shell";
import { DisclaimerContent } from "@/components/legal/disclaimer-content";

export default function DisclaimerPage() {
  return (
    <LegalPageShell title="Medical Disclaimer" document="disclaimer">
      <DisclaimerContent />
    </LegalPageShell>
  );
}
