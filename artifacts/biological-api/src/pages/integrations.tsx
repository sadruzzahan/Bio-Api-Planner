import { useQueryClient } from "@tanstack/react-query";
import { useListIntegrations, useConnectIntegration, useDisconnectIntegration, getListIntegrationsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SiApple, SiGarmin, SiFitbit } from "react-icons/si";

const PROVIDER_LOGOS: Record<string, React.ElementType> = {
  oura: Activity, // Fallback
  whoop: Activity, // Fallback
  dexcom: Activity, // Fallback
  apple_health: SiApple,
  garmin: SiGarmin,
  fitbit: SiFitbit,
  withings: Activity,
  cronometer: Activity, // Fallback
  myfitnesspal: Activity, // Fallback
  levels: Activity, // Fallback
  nutrisense: Activity, // Fallback
  eight_sleep: Activity, // Fallback
};

export default function Integrations() {
  const queryClient = useQueryClient();
  const { data: integrations, isLoading } = useListIntegrations();
  const connect = useConnectIntegration();
  const disconnect = useDisconnectIntegration();

  const handleConnect = (provider: string) => {
    connect.mutate({ provider }, {
      onSuccess: () => {
        toast.success(`Connected to ${provider}`);
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
      },
      onError: () => {
        toast.error(`Failed to connect to ${provider}`);
      }
    });
  };

  const handleDisconnect = (provider: string) => {
    disconnect.mutate({ provider }, {
      onSuccess: () => {
        toast.success("Integration disconnected");
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
      },
      onError: () => {
        toast.error("Failed to disconnect");
      }
    });
  };

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-8"
      >
        <div>
          <h1 className="text-3xl font-mono font-bold uppercase tracking-wider mb-2">Data Sources</h1>
          <p className="text-muted-foreground font-mono text-sm">Manage connections to external telemetry hardware and software.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))
          ) : (
            integrations?.map((integration) => {
              const Icon = PROVIDER_LOGOS[integration.provider.toLowerCase()] || Activity;
              
              return (
                <div key={integration.id} className="border border-border bg-card p-6 flex flex-col h-full rounded-lg transition-all hover:border-primary/50 relative overflow-hidden group">
                  {integration.status === "connected" && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  )}
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center text-foreground group-hover:text-primary transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant={integration.status === "connected" ? "default" : "outline"} className="font-mono text-[10px] uppercase">
                      {integration.status}
                    </Badge>
                  </div>
                  
                  <h3 className="font-mono font-bold text-lg capitalize mb-1">{integration.provider.replace('_', ' ')}</h3>
                  <p className="font-mono text-xs text-muted-foreground capitalize">{integration.category}</p>
                  
                  <div className="mt-auto pt-6 flex flex-col gap-4">
                    {integration.status === "connected" && integration.connectedAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <Clock className="w-3 h-3" />
                        <span>Last sync: {new Date(integration.connectedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {integration.status === "connected" ? (
                      <Button 
                        variant="outline" 
                        className="w-full font-mono text-xs uppercase" 
                        onClick={() => handleDisconnect(integration.provider)}
                        disabled={disconnect.isPending}
                        data-testid={`btn-disconnect-${integration.provider}`}
                      >
                        <Unlink className="w-3 h-3 mr-2" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button 
                        className="w-full font-mono text-xs uppercase bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/50" 
                        onClick={() => handleConnect(integration.provider)}
                        disabled={connect.isPending}
                        data-testid={`btn-connect-${integration.provider}`}
                      >
                        <Link2 className="w-3 h-3 mr-2" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </Layout>
  );
}
