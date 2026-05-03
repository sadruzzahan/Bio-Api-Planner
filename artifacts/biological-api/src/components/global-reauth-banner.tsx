import { Link, useLocation } from "wouter";
import { useListIntegrations } from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";

/**
 * Application-shell banner that appears on every authenticated page when
 * one or more provider integrations require the user to re-authenticate.
 * Hidden on the Integrations page itself to avoid stuttering with the
 * inline banner shown there.
 */
export function GlobalReauthBanner() {
  const [location] = useLocation();
  const { data: integrations } = useListIntegrations();
  if (!integrations) return null;
  if (location.startsWith("/integrations")) return null;

  const broken = integrations.filter((i) => i.status === "needs_reauth");
  if (broken.length === 0) return null;

  return (
    <div
      className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 flex items-center gap-3 text-sm font-mono"
      data-testid="banner-global-reauth"
      role="alert"
    >
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      <span className="text-destructive font-bold">
        Re-authenticate {broken.map((i) => i.displayName).join(", ")} to resume syncing.
      </span>
      <Link
        href="/integrations"
        className="ml-auto text-destructive underline hover:no-underline"
        data-testid="link-banner-reauth"
      >
        Reconnect →
      </Link>
    </div>
  );
}
