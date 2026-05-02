import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListGlucose, useGetGlucoseTrend } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { motion } from "framer-motion";
import { Droplet, TrendingUp, Clock, Activity, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fmt1 = (v: number | null | undefined) => v != null ? Number(v).toFixed(1) : "--";
const fmtPct = (v: number | null | undefined) => v != null ? Number(v).toFixed(1) : "--";

export default function Glucose() {
  const [contextFilter, setContextFilter] = useState<string>("all");
  
  const { data: readings, isLoading: isLoadingReadings } = useListGlucose(
    contextFilter !== "all" ? { mealContext: contextFilter } : {}
  );
  const { data: trend, isLoading: isLoadingTrend } = useGetGlucoseTrend();

  const getGlucoseColor = (value: number) => {
    if (value < 70 || value > 180) return "text-red-500";
    if (value >= 140 && value <= 180) return "text-yellow-500";
    return "text-green-500";
  };

  const getGlucoseBg = (value: number) => {
    if (value < 70 || value > 180) return "bg-red-500/10 text-red-500 border-red-500/20";
    if (value >= 140 && value <= 180) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-green-500/10 text-green-500 border-green-500/20";
  };

  return (
    <Layout>
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight uppercase" data-testid="text-page-title">Glucose Telemetry</h1>
            <p className="text-muted-foreground font-mono" data-testid="text-page-subtitle">Metabolic state and variability analysis</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border" data-testid="card-stat-avg">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Avg Glucose</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoadingTrend ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <span className={trend?.avgMgdl ? getGlucoseColor(trend.avgMgdl) : ""}>{fmt1(trend?.avgMgdl)}</span>
                    <span className="text-sm text-muted-foreground font-sans">mg/dL</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 border-border" data-testid="card-stat-tir">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Time in Range</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoadingTrend ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <span>{fmtPct(trend?.timeInRangePct)}</span>
                    <span className="text-sm text-muted-foreground font-sans">%</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 border-border" data-testid="card-stat-var">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Variability</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoadingTrend ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <span>{fmtPct(trend?.variabilityPct)}</span>
                    <span className="text-sm text-muted-foreground font-sans">%</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 border-border" data-testid="card-stat-peak">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono uppercase tracking-wider text-xs">Peak (30d)</CardDescription>
              <CardTitle className="text-3xl font-mono flex items-baseline gap-2">
                {isLoadingTrend ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <span className={trend?.peakMgdl ? getGlucoseColor(trend.peakMgdl) : ""}>{fmt1(trend?.peakMgdl)}</span>
                    <span className="text-sm text-muted-foreground font-sans">mg/dL</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Chart */}
        <Card className="bg-card/50 border-border" data-testid="card-trend-chart">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-wider text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              30-Day Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {isLoadingTrend ? (
                <Skeleton className="h-full w-full" />
              ) : trend?.points && trend.points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={['dataMin - 10', 'dataMax + 10']}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                      labelFormatter={(val) => format(new Date(val), "MMM d, yyyy")}
                    />
                    <ReferenceLine y={140} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Area 
                      type="monotone" 
                      dataKey="avgMgdl" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorAvg)" 
                      name="Avg Glucose (mg/dL)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                  No trend data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Readings List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-bold uppercase tracking-wider">Recent Readings</h2>
            <Select value={contextFilter} onValueChange={setContextFilter}>
              <SelectTrigger className="w-[180px] font-mono text-xs uppercase" data-testid="select-context">
                <SelectValue placeholder="Filter Context" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contexts</SelectItem>
                <SelectItem value="fasting">Fasting</SelectItem>
                <SelectItem value="post_meal">Post Meal</SelectItem>
                <SelectItem value="exercise">Exercise</SelectItem>
                <SelectItem value="bedtime">Bedtime</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-card/50 border-border overflow-hidden">
            <div className="divide-y divide-border">
              {isLoadingReadings ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))
              ) : readings && readings.length > 0 ? (
                readings.map((reading) => (
                  <div key={reading.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors" data-testid={`row-reading-${reading.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-primary/10 text-primary">
                        <Droplet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-mono text-sm font-medium">
                          {format(new Date(reading.recordedAt), "MMM d, HH:mm")}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase text-muted-foreground">
                            {reading.mealContext.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{reading.source}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-lg font-bold ${getGlucoseColor(reading.valueMgdl)}`}>
                        {reading.valueMgdl}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">mg/dL</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                  No readings found
                </div>
              )}
            </div>
          </Card>
        </div>
      </motion.div>
    </Layout>
  );
}
