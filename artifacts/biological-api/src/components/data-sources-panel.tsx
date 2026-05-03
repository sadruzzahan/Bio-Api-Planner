import { Link } from "wouter";
import { useListIntegrations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderLogo } from "@/components/provider-logo";
import { AlertTriangle, Clock, Cpu, Timer } from "lucide-react";

function past(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "soon";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function future(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  connected:    { label: "OK",         className: "bg-primary/15 text-primary border-primary/30" },
  needs_reauth: { label: "Re-auth",    className: "bg-destructive/15 text-destructive border-destructive/30" },
  error:        { label: "Sync error", className: "bg-destructive/15 text-destructive border-destructive/30" },
  connecting:   { label: "Connecting", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
};

export function DataSourcesPanel() {
  const { data: integrations, isLoading } = useListIntegrations();
  // Only show rows the user has actually engaged with — disconnected /
  // never-connected providers belong on the Integrations page, not here.
  const live = (integrations ?? []).filter(
    (i) => i.status !== "disconnected",
  );

  return (
    <Card data-testid="card-data-sources">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          Data Sources
        </CardTitle>
        <Link
          href="/integrations"
          className="text-[11px] font-mono text-primary hover:underline"
          data-testid="link-manage-data-sources"
        >
          Manage →
        </Link>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : live.length === 0 ? (
          <p className="text-xs font-mono text-muted-foreground">
            No data sources connected yet.{" "}
            <Link href="/integrations" className="text-primary hover:underline">
              Connect a wearable or CGM
            </Link>{" "}
            to start collecting telemetry.
          </p>
        ) : (
          <ul className="space-y-2">
            {live.map((i) => {
              const status = STATUS_LABEL[i.status] ?? STATUS_LABEL.connected!;
              const next = future(i.nextSyncAt);
              return (
                <li
                  key={i.provider}
                  className="flex items-center gap-3 border border-border rounded-md p-2"
                  data-testid={`data-source-row-${i.provider}`}
                >
                  <ProviderLogo provider={i.provider} className="w-8 h-8 text-xs rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold truncate">{i.displayName}</span>
                      <Badge variant="outline" className={`font-mono text-[9px] uppercase ${status.className}`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {past(i.lastSyncAt)}
                      </span>
                      {next && i.status === "connected" && (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="w-3 h-3" /> next {next}
                        </span>
                      )}
                    </div>
                    {i.lastError && (
                      <div className="text-[10px] font-mono text-destructive flex items-center gap-1 mt-0.5 truncate" title={i.lastError}>
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{i.lastError}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
