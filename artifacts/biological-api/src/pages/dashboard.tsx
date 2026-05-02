import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, Brain, Shield, Target, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/layout";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!dashboard) {
    return (
      <Layout>
        <div className="text-destructive font-mono p-8">Failed to load telemetry.</div>
      </Layout>
    );
  }

  const { state, summary, pendingInterventions, recentInsights } = dashboard;

  const stateColors: Record<string, string> = {
    peak: "text-green-500 border-green-500/20 bg-green-500/10",
    optimal: "text-primary border-primary/20 bg-primary/10",
    moderate: "text-yellow-500 border-yellow-500/20 bg-yellow-500/10",
    fatigued: "text-orange-500 border-orange-500/20 bg-orange-500/10",
    stressed: "text-red-500 border-red-500/20 bg-red-500/10",
    depleted: "text-destructive border-destructive/20 bg-destructive/10",
  };

  const readinessColor = stateColors[state?.energyState?.toLowerCase()] || "text-primary border-primary/20 bg-primary/10";

  return (
    <Layout>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight uppercase" data-testid="dashboard-title">System Overview</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Real-time biological telemetry</p>
          </div>
          <div className={`px-4 py-2 border rounded-md flex items-center gap-3 ${readinessColor}`} data-testid="dashboard-status-badge">
            <Shield className="w-5 h-5" />
            <div>
              <div className="text-xs font-mono uppercase tracking-wider opacity-80">System State</div>
              <div className="font-bold font-mono uppercase tracking-widest">{state?.energyState || "Unknown"}</div>
            </div>
            <div className="text-2xl font-bold ml-2 font-mono">{state?.readinessScore || 0}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-primary/20 bg-card/50" data-testid="metric-hrv">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-mono uppercase text-muted-foreground">Recovery</CardTitle>
              <Activity className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">{state?.recoveryState || "N/A"}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50" data-testid="metric-sleep">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-mono uppercase text-muted-foreground">Sleep Eff.</CardTitle>
              <Brain className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">{summary?.sleepEfficiencyPct || 0}%</div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50" data-testid="metric-glucose">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-mono uppercase text-muted-foreground">Glucose Avg</CardTitle>
              <Target className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">{summary?.glucoseAvgMgdl || 0} <span className="text-xs text-muted-foreground">mg/dL</span></div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50" data-testid="metric-strain">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-mono uppercase text-muted-foreground">System Strain</CardTitle>
              <Zap className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">{summary?.strainScore || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-primary/20 bg-card/50" data-testid="dashboard-insights">
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" /> System Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentInsights?.map((insight: any) => (
                <div key={insight.id} className="p-4 rounded-md border border-border bg-background/50" data-testid={`insight-${insight.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={insight.severity === 'high' ? 'destructive' : 'default'} className="font-mono text-[10px] uppercase">
                      {insight.severity}
                    </Badge>
                    <span className="font-mono font-bold text-sm uppercase text-foreground">{insight.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.body}</p>
                </div>
              ))}
              {!recentInsights?.length && (
                <div className="text-center p-4 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md">
                  No active insights. System operating normally.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50" data-testid="dashboard-interventions">
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" /> Pending Interventions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingInterventions?.map((intervention: any) => (
                <div key={intervention.id} className="p-4 rounded-md border border-border bg-background/50 flex flex-col gap-2" data-testid={`intervention-${intervention.id}`}>
                  <div className="font-mono font-bold text-sm uppercase text-foreground">{intervention.title}</div>
                  <p className="text-sm text-muted-foreground">{intervention.action}</p>
                  <p className="text-xs text-primary/80 font-mono mt-1">&gt; {intervention.rationale}</p>
                </div>
              ))}
              {!pendingInterventions?.length && (
                <div className="text-center p-4 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md">
                  No pending interventions.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AnimatePresence>
    </Layout>
  );
}
