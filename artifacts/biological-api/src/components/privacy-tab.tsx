import { useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import {
  useListConsent,
  useListAuditLog,
  useDeleteCurrentUser,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Trash2, FileText, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * Profile → Privacy tab. Lets the operator export a copy of their data,
 * irreversibly schedule deletion, and review their consent + audit history.
 */
export function PrivacyTab() {
  const { user: clerkUser } = useUser();
  const consent = useListConsent();
  const audit = useListAuditLog({ limit: 100 });
  const deleteAccount = useDeleteCurrentUser();
  const [exporting, setExporting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const operatorEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";

  const consentRecords = useMemo(() => {
    const all = consent.data?.records ?? [];
    // Surface the latest record per (document, version, accepted) tuple so
    // the operator sees a clean history instead of duplicate logs.
    return [...all].sort(
      (a, b) => +new Date(b.acceptedAt) - +new Date(a.acceptedAt),
    );
  }, [consent.data]);

  const auditEntries = audit.data?.entries ?? [];

  const exportData = async () => {
    setExporting(true);
    try {
      // Use the raw fetch so the browser triggers a true file-download UX.
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/me/export`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `bioos-export-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error("Export failed — try again or contact support");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const submitDelete = () => {
    if (confirmEmail.trim().toLowerCase() !== operatorEmail.toLowerCase()) {
      toast.error("Email does not match your account");
      return;
    }
    deleteAccount.mutate(
      { data: { confirmEmail: confirmEmail.trim() } },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast.success("Account scheduled for deletion. Signing you out…");
          // The server revokes the Clerk session; the next request will 401
          // and the app redirects to /sign-in. Force a reload to clear caches.
          setTimeout(() => {
            window.location.href = `${import.meta.env.BASE_URL}`;
          }, 1500);
        },
        onError: () => {
          toast.error("Failed to delete account. Please try again.");
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      {/* Export */}
      <Section
        icon={Download}
        title="Export my data"
        description="Download a JSON archive of every record we hold for your account: profile, biometrics, sleep, glucose, activity, meals, supplements, interventions, chat, integrations and consent history."
      >
        <Button
          type="button"
          onClick={exportData}
          disabled={exporting}
          className="font-mono uppercase tracking-wider"
          data-testid="btn-export-data"
        >
          <Download className="w-4 h-4 mr-2" />
          {exporting ? "Preparing…" : "Download JSON archive"}
        </Button>
      </Section>

      {/* Delete */}
      <Section
        icon={Trash2}
        title="Delete my account"
        description="Permanently deletes your account and all associated data. Soft-deleted immediately; purged after a 30-day grace window. This cannot be undone after the grace window expires."
        destructive
      >
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="font-mono uppercase tracking-wider"
              data-testid="btn-delete-account"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete account…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent data-testid="delete-account-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Delete your BioOS account?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-sans text-sm">
                This will soft-delete your account immediately and{" "}
                <strong>permanently destroy all data</strong> after a 30-day
                grace window. To confirm, type your email address (
                <code className="font-mono text-xs">{operatorEmail}</code>)
                exactly.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2 space-y-2">
              <Label htmlFor="confirm-email" className="font-mono text-xs uppercase tracking-wider">
                Confirm email
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="font-mono"
                autoComplete="off"
                data-testid="input-confirm-email"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="font-mono uppercase text-xs tracking-wider"
                data-testid="btn-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  submitDelete();
                }}
                disabled={
                  deleteAccount.isPending ||
                  confirmEmail.trim().toLowerCase() !== operatorEmail.toLowerCase()
                }
                className="font-mono uppercase text-xs tracking-wider bg-destructive hover:bg-destructive/80"
                data-testid="btn-confirm-delete"
              >
                {deleteAccount.isPending ? "Deleting…" : "I understand, delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      {/* Consent history */}
      <Section
        icon={FileText}
        title="Consent history"
        description="Every legal-document acceptance recorded for your account."
      >
        {consent.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : consentRecords.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No consent records yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="consent-history">
            {consentRecords.map((r) => (
              <li
                key={r.id}
                className="border border-border bg-card/50 rounded p-3 flex items-center justify-between gap-3 font-mono text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                      r.accepted
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {r.accepted ? "Accepted" : "Revoked"}
                  </span>
                  <span className="uppercase tracking-wider">{r.document}</span>
                  <span className="text-muted-foreground">v{r.version}</span>
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {new Date(r.acceptedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Audit log */}
      <Section
        icon={Activity}
        title="Recent activity"
        description="The last 100 security-relevant actions on your account. This log is append-only."
      >
        {audit.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : auditEntries.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div
            className="border border-border bg-card/50 rounded max-h-80 overflow-y-auto"
            data-testid="audit-log"
          >
            <ul className="divide-y divide-border">
              {auditEntries.map((e) => (
                <li key={e.id} className="p-3 flex items-center justify-between gap-3 font-mono text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-primary/10 text-primary">
                      {e.action}
                    </span>
                    <span className="uppercase tracking-wider truncate">{e.entity}</span>
                    {e.entityId && (
                      <span className="text-muted-foreground truncate">#{e.entityId}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}

interface SectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  destructive?: boolean;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, description, destructive, children }: SectionProps) {
  return (
    <section
      className={`border rounded-lg p-5 space-y-3 ${
        destructive ? "border-destructive/30 bg-destructive/5" : "border-border bg-card/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={`w-4 h-4 mt-1 shrink-0 ${destructive ? "text-destructive" : "text-primary"}`}
        />
        <div className="flex-1">
          <h3 className="font-mono font-bold uppercase tracking-wider text-sm">{title}</h3>
          <p className="font-sans text-xs text-muted-foreground mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <div className="pt-1">{children}</div>
    </section>
  );
}
