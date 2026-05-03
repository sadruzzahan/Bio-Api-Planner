import { Link } from "wouter";
import { Stethoscope } from "lucide-react";

/**
 * Compact, non-removable pill rendered on every assistant chat bubble.
 * Wording is locked-in to satisfy the "informational only — not medical
 * advice" requirement from the medical disclaimer.
 */
export function MedicalDisclaimerPill() {
  return (
    <div
      className="mt-3 flex items-start gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-t border-border/40 pt-2"
      data-testid="medical-disclaimer-pill"
    >
      <Stethoscope className="w-3 h-3 mt-0.5 shrink-0" />
      <span className="leading-relaxed">
        Educational use only — not medical advice.{" "}
        <Link
          href="/legal/disclaimer"
          target="_blank"
          className="text-primary hover:underline"
        >
          Learn more
        </Link>
      </span>
    </div>
  );
}

/**
 * First-session, dismissible disclaimer banner shown above the chat composer
 * the very first time the operator opens the chat. Persists dismissal in
 * localStorage so it doesn't re-appear.
 */
export function ChatFirstSessionDisclaimer({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="mb-3 flex items-start gap-2 border border-primary/30 bg-primary/5 rounded-md p-3"
      data-testid="chat-first-session-disclaimer"
    >
      <Stethoscope className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 text-xs font-mono leading-relaxed">
        <p className="font-bold uppercase tracking-wider text-primary mb-1">
          Heads up
        </p>
        <p className="text-muted-foreground">
          The BioOS assistant is informational only. It is not a clinician and
          may be wrong. Always confirm health decisions with a qualified
          professional.{" "}
          <Link href="/legal/disclaimer" className="text-primary hover:underline">
            Read the full medical disclaimer.
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
        data-testid="chat-disclaimer-dismiss"
      >
        Got it
      </button>
    </div>
  );
}
