import { useQueryClient } from "@tanstack/react-query";
import { useListIntegrations, useConnectIntegration, useDisconnectIntegration, getListIntegrationsQueryKey } from "@workspace/api-client-react";
import type { Integration } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Link2, Unlink, Cpu, Droplet, Utensils, Home, Calendar, FlaskConical } from "lucide-react";
import { SiApple, SiGarmin, SiFitbit } from "react-icons/si";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PROVIDER_LOGOS: Record<string, React.ElementType> = {
  apple_health: SiApple,
  garmin: SiGarmin,
  fitbit: SiFitbit,
};

const TIER_GROUPS: { label: string; category: string; icon: React.ElementType; description: string }[] = [
  { label: "Wearables", category: "wearable", icon: Activity, description: "Heart rate, HRV, sleep, and activity trackers" },
  { label: "Continuous Glucose Monitors", category: "cgm", icon: Droplet, description: "Real-time glucose and metabolic monitoring" },
  { label: "Lab & Blood Tests", category: "lab", icon: FlaskConical, description: "Biomarker panels and diagnostic results" },
  { label: "Smart Home", category: "smart_home", icon: Home, description: "Environment sensors and sleep hardware" },
  { label: "Nutrition & Food Logging", category: "nutrition", icon: Utensils, description: "Macro tracking and dietary analysis" },
  { label: "Calendar & Scheduling", category: "calendar", icon: Calendar, description: "Time blocking and circadian alignment" },
];

function IntegrationCard({ integration, onConnect, onDisconnect, isPending }: {
  integration: Integration;
  onConnect: (p: string) => void;
  onDisconnect: (p: string) => void;
  isPending: boolean;
}) {
  const Icon = PROVIDER_LOGOS[integration.provider.toLowerCase()] || Cpu;
  const isConnected = integration.status === "connected";

  return (
    <div
      className={`border bg-card p-5 flex flex-col rounded-lg transition-all hover:border-primary/40 relative overflow-hidden ${
        isConnected ? "border-primary/30" : "border-border"
      }`}
      data-testid={`card-integration-${integration.provider}`}
    >
      {isConnected && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground">
          <Icon className="w-5 h-5" />
        </div>
        <Badge
          variant={isConnected ? "default" : "outline"}
          className={`font-mono text-[10px] uppercase ${isConnected ? "bg-primary/20 text-primary border-primary/30" : ""}`}
        >
          {integration.status}
        </Badge>
      </div>
      <h3 className="font-mono font-bold capitalize mb-0.5">{integration.provider.replace(/_/g, " ")}</h3>
      {isConnected && integration.connectedAt && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-1">
          <Clock className="w-3 h-3" />
          <span>Since {new Date(integration.connectedAt).toLocaleDateString()}</span>
        </div>
      )}
      <div className="mt-auto pt-4">
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full font-mono text-xs uppercase"
            onClick={() => onDisconnect(integration.provider)}
            disabled={isPending}
            data-testid={`btn-disconnect-${integration.provider}`}
          >
            <Unlink className="w-3 h-3 mr-2" /> Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full font-mono text-xs uppercase bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/40"
            onClick={() => onConnect(integration.provider)}
            disabled={isPending}
            data-testid={`btn-connect-${integration.provider}`}
          >
            <Link2 className="w-3 h-3 mr-2" /> Connect
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Integrations() {
  const queryClient = useQueryClient();
  const { data: integrations, isLoading } = useListIntegrations();
  const connect = useConnectIntegration();
  const disconnect = useDisconnectIntegration();

  const handleConnect = (provider: string) => {
    connect.mutate({ provider }, {
      onSuccess: () => {
        toast.success(`Connected to ${provider.replace(/_/g, " ")}`);
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
      },
      onError: () => toast.error(`Failed to connect to ${provider}`)
    });
  };

  const handleDisconnect = (provider: string) => {
    disconnect.mutate({ provider }, {
      onSuccess: () => {
        toast.success("Integration disconnected");
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
      },
      onError: () => toast.error("Failed to disconnect")
    });
  };

  const grouped = integrations ? TIER_GROUPS.reduce<Record<string, Integration[]>>((acc, tier) => {
    const matches = integrations.filter(i => i.category === tier.category);
    if (matches.length > 0) acc[tier.category] = matches;
    return acc;
  }, {}) : {};

  const ungrouped = integrations?.filter(i =>
    !TIER_GROUPS.some(t => t.category === i.category)
  ) ?? [];

  const connectedCount = integrations?.filter(i => i.status === "connected").length ?? 0;

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-10"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold uppercase tracking-wider" data-testid="text-page-title">Data Sources</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Manage connections to external telemetry hardware and software.</p>
          </div>
          <div className="font-mono text-sm text-muted-foreground">
            <span className="text-primary font-bold">{connectedCount}</span> connected
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
          </div>
        ) : (
          <>
            {TIER_GROUPS.map((tier) => {
              const tierIntegrations = grouped[tier.category];
              if (!tierIntegrations) return null;
              const TierIcon = tier.icon;
              return (
                <section key={tier.category} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <TierIcon className="w-4 h-4 text-primary" />
                    <h2 className="font-mono font-bold uppercase tracking-wider text-sm">{tier.label}</h2>
                    <span className="text-xs font-mono text-muted-foreground ml-1">— {tier.description}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tierIntegrations.map(integration => (
                      <IntegrationCard
                        key={integration.id}
                        integration={integration}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        isPending={connect.isPending || disconnect.isPending}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {ungrouped.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <h2 className="font-mono font-bold uppercase tracking-wider text-sm">Other</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ungrouped.map(integration => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      onConnect={handleConnect}
                      onDisconnect={handleDisconnect}
                      isPending={connect.isPending || disconnect.isPending}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
}
