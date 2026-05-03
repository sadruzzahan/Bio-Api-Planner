import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useClerk } from "@clerk/react";
import {
  useListConsent,
  useRecordConsent,
  getListConsentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, FileText, Stethoscope, LogOut } from "lucide-react";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { TermsContent } from "@/components/legal/terms-content";
import { PrivacyContent } from "@/components/legal/privacy-content";
import { DisclaimerContent } from "@/components/legal/disclaimer-content";

const REQUIRED_DOCS: Array<{
  doc: "tos" | "privacy" | "disclaimer";
  label: string;
  icon: React.ElementType;
  body: React.ReactNode;
}> = [
  { doc: "tos", label: "Terms of Service", icon: FileText, body: <TermsContent /> },
  { doc: "privacy", label: "Privacy Policy", icon: ShieldAlert, body: <PrivacyContent /> },
  { doc: "disclaimer", label: "Medical Disclaimer", icon: Stethoscope, body: <DisclaimerContent /> },
];

/**
 * Blocks the app shell until the signed-in operator has accepted the current
 * versions of the ToS, Privacy Policy and Medical Disclaimer. Acceptance is
 * persisted server-side; refusing signs the operator out.
 */
export function PostSigninConsentModal({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { data, isLoading, isError } = useListConsent();
  const recordConsent = useRecordConsent();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeDoc, setActiveDoc] = useState<typeof REQUIRED_DOCS[number]["doc"]>("tos");

  const missingDocs = useMemo(() => {
    if (isLoading || isError || !data) return [];
    const records = data.records ?? [];
    return REQUIRED_DOCS.filter(({ doc }) => {
      const latest = records
        .filter((r) => r.document === doc && r.accepted)
        .sort((a, b) => +new Date(b.acceptedAt) - +new Date(a.acceptedAt))[0];
      return !latest || latest.version !== LEGAL_VERSIONS[doc];
    });
  }, [data, isLoading, isError]);

  // CRITICAL: while we don't yet know whether the user has accepted the
  // current legal versions, do NOT render children — otherwise a fast
  // operator could interact with the app for the few hundred ms before the
  // modal mounts and bypass the gate.
  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-background"
        data-testid="consent-loading"
      >
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  // If the consent endpoint is unreachable we MUST fail closed: rendering
  // the app without a verified consent state would let an operator perform
  // sensitive actions (chat, integrations) before they have legally agreed
  // to the current Terms / Privacy / Disclaimer. Show a hard error screen
  // with a retry instead.
  if (isError) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-background p-6"
        data-testid="consent-error"
      >
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-mono uppercase tracking-wider text-base text-destructive">
            Unable to verify your consent state
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            We couldn't load your privacy preferences. Until we can confirm
            you have accepted the current legal documents, the app is locked
            for your protection. Check your connection and try again.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-mono uppercase tracking-wider text-xs px-4 py-2 border border-primary text-primary rounded hover:bg-primary/10"
              data-testid="consent-error-retry"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: window.location.origin })}
              className="font-mono uppercase tracking-wider text-xs px-4 py-2 border border-border text-muted-foreground rounded hover:bg-accent"
              data-testid="consent-error-signout"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (missingDocs.length === 0) {
    return <>{children}</>;
  }

  const allAccepted = missingDocs.every((d) => checked[d.doc]);

  const submit = async () => {
    setSubmitting(true);
    try {
      for (const d of missingDocs) {
        await recordConsent.mutateAsync({
          data: {
            document: d.doc,
            version: LEGAL_VERSIONS[d.doc],
            accepted: true,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListConsentQueryKey() });
    } finally {
      setSubmitting(false);
    }
  };

  const declineAndSignOut = async () => {
    await signOut();
  };

  const active = missingDocs.find((d) => d.doc === activeDoc) ?? missingDocs[0]!;
  const ActiveIcon = active.icon;

  // FAIL CLOSED: render only the modal (no children) so the underlying app
  // shell never mounts before consent is recorded. Mounting children here
  // would let queries/effects fire and trigger writes (state classification,
  // intervention planning, etc.) before legal acceptance.
  return (
    <div
      className="fixed inset-0 z-[60] bg-background"
      data-testid="consent-gate"
    >
      <Dialog open modal>
        <DialogContent
          className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 [&>button.absolute]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          data-testid="consent-modal"
        >
          <div className="border-b border-border p-6">
            <DialogTitle className="font-mono uppercase tracking-wider text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Review &amp; accept to continue
            </DialogTitle>
            <DialogDescription className="font-sans text-xs text-muted-foreground mt-2">
              We've updated the documents below. Please review and accept each
              one before continuing to BioOS. You can read the full text on
              this page or open the standalone version.
            </DialogDescription>
          </div>

          <div className="flex border-b border-border bg-card/50 shrink-0">
            {missingDocs.map((d) => {
              const Icon = d.icon;
              const isActive = d.doc === activeDoc;
              return (
                <button
                  key={d.doc}
                  type="button"
                  onClick={() => setActiveDoc(d.doc)}
                  className={`flex-1 px-4 py-3 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-r last:border-r-0 border-border transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`consent-tab-${d.doc}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{d.label}</span>
                  {checked[d.doc] && <span className="text-primary">✓</span>}
                </button>
              );
            })}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ActiveIcon className="w-4 h-4 text-primary" />
                <h2 className="font-mono font-bold uppercase tracking-wider text-sm">
                  {active.label} · v{LEGAL_VERSIONS[active.doc]}
                </h2>
                <Link
                  href={`/legal/${active.doc === "tos" ? "terms" : active.doc}`}
                  target="_blank"
                  className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                >
                  Open standalone
                </Link>
              </div>
              <article className="prose prose-invert max-w-none font-sans leading-relaxed [&_h2]:font-mono [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-sm [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-primary [&_h3]:font-mono [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-xs [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:text-xs [&_li]:text-xs [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
                {active.body}
              </article>
            </div>
          </ScrollArea>

          <div className="border-t border-border p-6 space-y-4 shrink-0">
            <div className="space-y-2">
              {missingDocs.map((d) => (
                <label
                  key={d.doc}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <Checkbox
                    checked={!!checked[d.doc]}
                    onCheckedChange={(v) =>
                      setChecked((prev) => ({ ...prev, [d.doc]: !!v }))
                    }
                    data-testid={`consent-check-${d.doc}`}
                    className="mt-0.5"
                  />
                  <span className="text-xs font-mono leading-relaxed">
                    I have read and agree to the{" "}
                    <span className="text-primary">{d.label}</span> (v
                    {LEGAL_VERSIONS[d.doc]}).
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={declineAndSignOut}
                className="font-mono text-xs uppercase tracking-wider"
                data-testid="consent-decline"
              >
                <LogOut className="w-3 h-3 mr-2" />
                Decline &amp; sign out
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!allAccepted || submitting}
                onClick={submit}
                className="font-mono text-xs uppercase tracking-wider"
                data-testid="consent-accept"
              >
                {submitting ? "Recording…" : "Accept &amp; continue"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
