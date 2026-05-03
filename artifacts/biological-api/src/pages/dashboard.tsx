import { useQueryClient } from "@tanstack/react-query";
import { useGetDashboard, useGetInsights, useUpdateIntervention, getGetDashboardQueryKey } from "@workspace/api-client-react";
import type { Insight, Intervention } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, Brain, Check, Loader2, Shield, Target, X, Zap } from "lucide-react";
import { Layout } from "@/components/layout";
import { toast } from "sonner";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: dashboard, isLoading } = useGetDashboard();
  const { data: insightsData, isLoading: insightsLoading } = useGetInsights();
  const updateIntervention = useUpdateIntervention();

  const handleInterventionAction = (id: number, status: "executed" | "dismissed") => {
    updateIntervention.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast.success(status === "executed" ? "Protocol executed" : "Protocol dismissed");
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: () => toast.error("Failed to update protocol"),
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
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

  const { state, summary, pendingInterventions } = dashboard;
  const recentInsights: Insight[] = insightsData ?? [];

  const stateColors: Record<string, string> = {
    peak: "text-green-500 border-green-500/20 bg-green-500/10",
    optimal: "text-primary border-primary/20 bg-primary/10",
    good: "text-primary border-primary/20 bg-primary/10",
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

        {/* 5 Biological State Dimensions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {([
            { label: "Energy", value: state?.energyState, icon: Zap, testId: "dim-energy" },
            { label: "Recovery", value: state?.recoveryState, icon: Activity, testId: "dim-recovery" },
            { label: "Cognitive", value: state?.cognitiveState, icon: Brain, testId: "dim-cognitive" },
            { label: "Stress", value: state?.stressState, icon: Shield, testId: "dim-stress" },
            { label: "Metabolic", value: state?.metabolicState, icon: Target, testId: "dim-metabolic" },
          ] as const).map(({ label, value, icon: Icon, testId }) => {
            const v = value?.toLowerCase() ?? "";
            const color = (v === "peak" || v === "optimal" || v === "high" || v === "good")
              ? "border-green-500/30 text-green-400"
              : (v === "moderate" || v === "medium")
              ? "border-yellow-500/30 text-yellow-400"
              : (v === "low" || v === "fatigued" || v === "stressed" || v === "depleted" || v === "poor")
              ? "border-red-500/30 text-red-400"
              : "border-primary/20 text-primary";
            return (
              <Card key={label} className={`bg-card/50 border ${color}`} data-testid={testId}>
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">{label}</CardTitle>
                  <Icon className="w-3.5 h-3.5 opacity-60" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-base font-bold font-mono capitalize leading-tight">{value || "—"}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-primary/20 bg-card/50" data-testid="metric-sleep">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-mono uppercase text-muted-foreground">Sleep Efficiency</CardTitle>
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
              <div className="text-2xl font-bold font-mono text-foreground">
                {summary?.glucoseAvgMgdl || 0} <span className="text-xs text-muted-foreground">mg/dL</span>
              </div>
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
            <CardContent className="space-y-3">
              {insightsLoading && (
                <div
                  className="flex items-center justify-center gap-2 p-6 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md"
                  data-testid="insights-loading"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Generating insights…</span>
                </div>
              )}
              {!insightsLoading && recentInsights.map((insight: Insight) => (
                <div key={insight.id} className="p-4 rounded-md border border-border bg-background/50" data-testid={`insight-${insight.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={insight.severity === "high" ? "destructive" : "default"} className="font-mono text-[10px] uppercase">
                      {insight.severity}
                    </Badge>
                    <span className="font-mono font-bold text-sm uppercase text-foreground">{insight.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.body}</p>
                </div>
              ))}
              {!insightsLoading && !recentInsights.length && (
                <div className="text-center p-4 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md">
                  No active insights. System operating normally.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50" data-testid="dashboard-interventions">
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" /> Pending Protocols
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInterventions?.map((intervention: Intervention) => (
                <div
                  key={intervention.id}
                  className="p-4 rounded-md border border-border bg-background/50 flex flex-col gap-3"
                  data-testid={`intervention-${intervention.id}`}
                >
                  <div>
                    <div className="font-mono font-bold text-sm uppercase text-foreground mb-1">{intervention.title}</div>
                    <p className="text-sm text-muted-foreground">{intervention.action}</p>
                    {intervention.rationale && (
                      <p className="text-xs text-primary/70 font-mono mt-1">&gt; {intervention.rationale}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="font-mono text-xs uppercase h-7 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30"
                      onClick={() => handleInterventionAction(intervention.id, "executed")}
                      disabled={updateIntervention.isPending}
                      data-testid={`btn-execute-${intervention.id}`}
                    >
                      <Check className="w-3 h-3 mr-1" /> Execute
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="font-mono text-xs uppercase h-7 px-3 text-muted-foreground hover:text-foreground"
                      onClick={() => handleInterventionAction(intervention.id, "dismissed")}
                      disabled={updateIntervention.isPending}
                      data-testid={`btn-dismiss-${intervention.id}`}
                    >
                      <X className="w-3 h-3 mr-1" /> Dismiss
                    </Button>
                  </div>
                </div>
              ))}
              {!pendingInterventions?.length && (
                <div className="text-center p-4 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md">
                  No pending interventions. System optimal.
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
