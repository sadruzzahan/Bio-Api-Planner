import { useEffect, useMemo, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useListIntegrations,
  useDisconnectIntegration,
  useSyncIntegrationNow,
  getListIntegrationsQueryKey,
  customFetch,
  type Integration,
  type IntegrationSyncRun,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Clock,
  Link2,
  Unlink,
  Cpu,
  Droplet,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const TIER_GROUPS: { label: string; category: string; icon: React.ElementType; description: string }[] = [
  { label: "Wearables", category: "wearable", icon: Activity, description: "Heart rate, HRV, sleep, and activity trackers" },
  { label: "Continuous Glucose Monitors", category: "cgm", icon: Droplet, description: "Real-time glucose and metabolic monitoring" },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  disconnected:  { label: "Not connected", className: "" },
  connecting:    { label: "Connecting…",   className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  connected:     { label: "Connected",     className: "bg-primary/20 text-primary border-primary/30" },
  needs_reauth:  { label: "Re-auth needed", className: "bg-destructive/15 text-destructive border-destructive/30" },
  error:         { label: "Sync error",    className: "bg-destructive/15 text-destructive border-destructive/30" },
};

function formatRelative(iso: string | null | undefined): string {
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

function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onSync,
  pendingProvider,
}: {
  integration: Integration;
  onConnect: (p: string) => void;
  onDisconnect: (p: string) => void;
  onSync: (id: number) => void;
  pendingProvider: string | null;
}) {
  const status = integration.status;
  const isConnected = status === "connected" || status === "needs_reauth" || status === "error";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.disconnected!;
  const isPending = pendingProvider === integration.provider;

  return (
    <div
      className={`border bg-card p-5 flex flex-col rounded-lg transition-all hover:border-primary/40 relative overflow-hidden ${
        status === "connected" ? "border-primary/30"
        : status === "needs_reauth" || status === "error" ? "border-destructive/40"
        : "border-border"
      }`}
      data-testid={`card-integration-${integration.provider}`}
    >
      {status === "connected" && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}
      {(status === "needs_reauth" || status === "error") && (
        <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
      )}

      <div className="flex justify-between items-start mb-3">
        <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground">
          <Cpu className="w-5 h-5" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className={`font-mono text-[10px] uppercase ${badge.className}`}>
            {badge.label}
          </Badge>
          {!integration.configured && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase">Not configured</Badge>
          )}
          {integration.sandbox && integration.configured && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase">Sandbox</Badge>
          )}
        </div>
      </div>

      <h3 className="font-mono font-bold mb-0.5">{integration.displayName}</h3>
      <p className="text-xs text-muted-foreground font-mono leading-relaxed mb-3">
        {integration.description}
      </p>

      {isConnected && (
        <div className="space-y-1 text-xs font-mono text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Last sync: {formatRelative(integration.lastSyncAt)}</span>
          </div>
          {integration.scopes && integration.scopes.length > 0 && (
            <div className="text-[10px] truncate" title={integration.scopes.join(", ")}>
              Scopes: {integration.scopes.slice(0, 3).join(", ")}
              {integration.scopes.length > 3 ? ` +${integration.scopes.length - 3}` : ""}
            </div>
          )}
          {integration.lastError && (
            <div className="text-destructive flex items-center gap-1.5 mt-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate" title={integration.lastError}>{integration.lastError}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto pt-2 flex flex-col gap-2">
        {!isConnected && (
          <Button
            size="sm"
            className="w-full font-mono text-xs uppercase bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/40"
            onClick={() => onConnect(integration.provider)}
            disabled={isPending || !integration.configured}
            data-testid={`btn-connect-${integration.provider}`}
          >
            <Link2 className="w-3 h-3 mr-2" /> Connect
          </Button>
        )}

        {status === "needs_reauth" && (
          <Button
            size="sm"
            variant="destructive"
            className="w-full font-mono text-xs uppercase"
            onClick={() => onConnect(integration.provider)}
            disabled={isPending}
            data-testid={`btn-reauth-${integration.provider}`}
          >
            <RefreshCw className="w-3 h-3 mr-2" /> Re-authenticate
          </Button>
        )}

        {(status === "connected" || status === "error") && integration.id != null && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 font-mono text-xs uppercase"
              onClick={() => onSync(integration.id!)}
              disabled={isPending}
              data-testid={`btn-sync-${integration.provider}`}
            >
              <RefreshCw className="w-3 h-3 mr-2" /> Sync now
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 font-mono text-xs uppercase"
              onClick={() => onDisconnect(integration.provider)}
              disabled={isPending}
              data-testid={`btn-disconnect-${integration.provider}`}
            >
              <Unlink className="w-3 h-3 mr-2" /> Disconnect
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReauthBanner({ items }: { items: Integration[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-4 flex items-start gap-3" data-testid="banner-reauth">
      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <div className="text-sm font-mono">
        <p className="font-bold text-destructive">
          {items.length} integration{items.length === 1 ? "" : "s"} need{items.length === 1 ? "s" : ""} re-authentication
        </p>
        <p className="text-muted-foreground mt-1">
          Tokens expired or were revoked at the provider:{" "}
          {items.map((i) => i.displayName).join(", ")}. Re-connect below to resume syncing.
        </p>
      </div>
    </div>
  );
}

function CallbackToast() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    if (!search) return;
    const params = new URLSearchParams(search);
    const provider = params.get("provider");
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected && provider) {
      toast.success(`Connected ${provider}`);
      queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
    } else if (error && provider) {
      toast.error(`Connection failed (${provider}): ${error.replace(/_/g, " ")}`);
    }
    if (connected || error) {
      // Clear the noisy querystring without a re-render storm.
      window.history.replaceState({}, "", window.location.pathname);
      void location;
      void setLocation;
    }
  }, [location, setLocation, queryClient]);
  return null;
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { data: integrations, isLoading } = useListIntegrations();
  const disconnect = useDisconnectIntegration();
  const sync = useSyncIntegrationNow();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const handleConnect = async (provider: string) => {
    setPendingProvider(provider);
    try {
      // Fetch the authorize URL via the API and then top-level navigate.
      const res = await customFetch<{ url: string }>(
        `/api/integrations/${provider}/authorize-url`,
        { method: "GET" },
      );
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(`Could not start ${provider} connection`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not start ${provider} connection: ${message}`);
    } finally {
      setPendingProvider(null);
    }
  };

  const handleDisconnect = (provider: string) => {
    setPendingProvider(provider);
    disconnect.mutate({ provider }, {
      onSuccess: () => {
        toast.success("Integration disconnected");
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
      },
      onError: () => toast.error("Failed to disconnect"),
      onSettled: () => setPendingProvider(null),
    });
  };

  const handleSync = (id: number) => {
    sync.mutate({ id }, {
      onSuccess: (r) => {
        if (r.status === "success") {
          toast.success(`Sync complete — ${r.recordsIngested} new record${r.recordsIngested === 1 ? "" : "s"}`);
        } else if (r.status === "skipped") {
          toast.info("Sync already in progress");
        } else {
          toast.error(`Sync failed: ${r.error ?? "unknown error"}`);
        }
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
      },
      onError: () => toast.error("Sync request failed"),
    });
  };

  const reauth = useMemo(
    () => (integrations ?? []).filter((i) => i.status === "needs_reauth"),
    [integrations],
  );
  const connectedCount = useMemo(
    () => (integrations ?? []).filter((i) => i.status === "connected").length,
    [integrations],
  );

  const grouped: Record<string, Integration[]> = {};
  for (const t of TIER_GROUPS) grouped[t.category] = [];
  for (const i of integrations ?? []) {
    (grouped[i.category] ??= []).push(i);
  }

  return (
    <Layout>
      <CallbackToast />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold uppercase tracking-wider" data-testid="text-page-title">
              Data Sources
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              Connect wearables and continuous glucose monitors. We pull only the scopes you grant.
            </p>
          </div>
          <div className="font-mono text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span><span className="text-primary font-bold">{connectedCount}</span> connected</span>
          </div>
        </div>

        <ReauthBanner items={reauth} />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
          </div>
        ) : (
          TIER_GROUPS.map((tier) => {
            const tierIntegrations = grouped[tier.category] ?? [];
            if (tierIntegrations.length === 0) return null;
            const TierIcon = tier.icon;
            return (
              <section key={tier.category} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <TierIcon className="w-4 h-4 text-primary" />
                  <h2 className="font-mono font-bold uppercase tracking-wider text-sm">{tier.label}</h2>
                  <span className="text-xs font-mono text-muted-foreground ml-1">— {tier.description}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tierIntegrations.map((integration) => (
                    <IntegrationCard
                      key={integration.provider}
                      integration={integration}
                      onConnect={handleConnect}
                      onDisconnect={handleDisconnect}
                      onSync={handleSync}
                      pendingProvider={pendingProvider}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </motion.div>
    </Layout>
  );
}

// Suppress unused-import lint for the type-only re-export used elsewhere.
export type { IntegrationSyncRun };
// Reference useQuery to avoid TS6133 in some build configurations where the
// hook is imported but not yet wired into the (planned) sync history modal.
void useQuery;
