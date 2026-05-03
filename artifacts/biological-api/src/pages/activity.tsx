import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListActivity, useGetCurrentState } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";
import { Zap, Activity as ActivityIcon, Timer, Flame, Brain, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Activity() {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: activities, isLoading } = useListActivity();
  const { data: state } = useGetCurrentState();

  const filteredActivities = activities?.filter(a => typeFilter === "all" || a.type === typeFilter);

  const getIntensityColor = (intensity: string) => {
    switch (intensity.toLowerCase()) {
      case "high": return "text-red-500 bg-red-500/10 border-red-500/20";
      case "moderate": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      case "low": return "text-green-500 bg-green-500/10 border-green-500/20";
      default: return "text-primary bg-primary/10 border-primary/20";
    }
  };

  const weeklyStats = activities ? {
    totalStrain: Math.round(activities.reduce((sum, a) => sum + (a.strainScore || 0), 0)),
    totalHours: +(activities.reduce((sum, a) => sum + a.durationMinutes, 0) / 60).toFixed(1),
    totalCalories: activities.reduce((sum, a) => sum + (a.calories || 0), 0),
    lowRatio: activities.length > 0
      ? Math.round(activities.filter(a => a.intensity?.toLowerCase() === "low").length / activities.length * 100)
      : 0,
  } : null;

  const chartData = (() => {
    if (!activities) return [];
    const dayMap: Record<string, { name: string; duration: number; strain: number }> = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    days.forEach(d => { dayMap[d] = { name: d, duration: 0, strain: 0 }; });
    activities.forEach(a => {
      const dow = days[new Date(a.recordedAt).getDay()];
      dayMap[dow].duration += a.durationMinutes;
      dayMap[dow].strain += a.strainScore || 0;
    });
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => dayMap[d]);
  })();

  const prescription = (() => {
    if (!state) return null;
    const score = state.readinessScore;
    const recovery = state.recoveryState?.toLowerCase();
    if (score >= 80 && (recovery === "high" || recovery === "optimal" || recovery === "good")) {
      return {
        type: "high_output",
        title: "High-Output Session Recommended",
        detail: `Readiness at ${score}% with ${recovery} recovery. Your CNS is primed — push a quality strength or interval session today.`,
        color: "text-green-400 border-green-400/30 bg-green-400/5",
        icon: TrendingUp,
      };
    }
    if (score >= 60) {
      return {
        type: "moderate",
        title: "Aerobic / Zone 2 Session",
        detail: `Readiness at ${score}%. Moderate recovery state detected. A Zone 2 aerobic session (45–60 min at low HR) will build base without adding CNS debt.`,
        color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
        icon: ActivityIcon,
      };
    }
    return {
      type: "rest",
      title: "Active Recovery Day",
      detail: `Readiness at ${score}%. System under stress — prioritize mobility, breath work, or a slow 20-minute walk. Hard training today risks compounding fatigue.`,
      color: "text-orange-400 border-orange-400/30 bg-orange-400/5",
      icon: TrendingDown,
    };
  })();

  return (
    <Layout>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight uppercase" data-testid="text-page-title">System Strain</h1>
          <p className="text-muted-foreground font-mono" data-testid="text-page-subtitle">Physical output and cardiovascular load</p>
        </div>

        {/* AI Exercise Prescription Card */}
        {prescription ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <Card className={`border ${prescription.color}`} data-testid="card-prescription">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <CardDescription className="font-mono uppercase tracking-wider text-xs">Today's Prescription</CardDescription>
                </div>
                <CardTitle className="font-mono text-lg">{prescription.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm text-muted-foreground">{prescription.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Skeleton className="h-28 w-full" />
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border" data-testid="card-stat-load">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Total Strain</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoading ? <Skeleton className="h-8 w-16" /> : (
                  <><span>{weeklyStats?.totalStrain ?? "--"}</span><span className="text-sm text-muted-foreground font-sans">AU</span></>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 border-border" data-testid="card-stat-duration">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Total Time</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoading ? <Skeleton className="h-8 w-16" /> : (
                  <><span>{weeklyStats?.totalHours ?? "--"}</span><span className="text-sm text-muted-foreground font-sans">hrs</span></>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 border-border" data-testid="card-stat-calories">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Energy Expended</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoading ? <Skeleton className="h-8 w-16" /> : (
                  <><span>{weeklyStats?.totalCalories.toLocaleString() ?? "--"}</span><span className="text-sm text-muted-foreground font-sans">kcal</span></>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 border-border" data-testid="card-stat-zones">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Low Intensity Ratio</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoading ? <Skeleton className="h-8 w-16" /> : (
                  <><span>{weeklyStats?.lowRatio ?? "--"}</span><span className="text-sm text-muted-foreground font-sans">%</span></>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Chart */}
        <Card className="bg-card/50 border-border" data-testid="card-zone-chart">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-wider text-sm flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-primary" />
              Weekly Activity (Duration &amp; Strain)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(v: number, name: string) => name === "duration" ? [`${v} min`, "Duration"] : [v, "Strain"]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "var(--font-mono)" }} />
                    <Bar dataKey="duration" fill="hsl(var(--primary))" name="Duration (min)" radius={[4, 4, 0, 0]} opacity={0.85} />
                    <Bar dataKey="strain" fill="hsl(188 60% 35%)" name="Strain" radius={[4, 4, 0, 0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-bold uppercase tracking-wider">Session Log</h2>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px] font-mono text-xs uppercase" data-testid="select-type">
                <SelectValue placeholder="Filter Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="cycling">Cycling</SelectItem>
                <SelectItem value="lifting">Strength</SelectItem>
                <SelectItem value="yoga">Mobility</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="bg-card/50 border-border p-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </Card>
              ))
            ) : filteredActivities && filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
                <Card key={activity.id} className="bg-card/50 border-border overflow-hidden hover:bg-accent/20 transition-colors" data-testid={`card-activity-${activity.id}`}>
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-primary/10 text-primary shrink-0">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-mono font-bold uppercase tracking-wider">{activity.type}</h3>
                        <div className="text-sm text-muted-foreground font-mono mt-1">
                          {format(new Date(activity.recordedAt), "MMM d, yyyy • HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 sm:gap-8 w-full sm:w-auto">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground font-mono uppercase">Duration</div>
                        <div className="font-mono flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {activity.durationMinutes} min
                        </div>
                      </div>
                      {activity.calories && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-mono uppercase">Energy</div>
                          <div className="font-mono flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            {activity.calories} kcal
                          </div>
                        </div>
                      )}
                      {activity.avgHeartRate && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-mono uppercase">Avg HR</div>
                          <div className="font-mono flex items-center gap-1">
                            <ActivityIcon className="w-3 h-3" />
                            {activity.avgHeartRate} bpm
                          </div>
                        </div>
                      )}
                      <div className="space-y-1 flex items-center h-full">
                        <Badge variant="outline" className={`font-mono text-xs uppercase ${getIntensityColor(activity.intensity)}`}>
                          {activity.intensity} Load
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-card/50 border-border p-8 text-center">
                <div className="text-muted-foreground font-mono text-sm">No activity sessions found</div>
              </Card>
            )}
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
