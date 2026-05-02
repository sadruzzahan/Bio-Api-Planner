import { useListSleep, useGetSleepTrend } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Clock, Zap } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";

export default function Sleep() {
  const { data: trendData, isLoading: isLoadingTrend } = useGetSleepTrend();
  const { data: sessionsData, isLoading: isLoadingSessions } = useListSleep();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight uppercase" data-testid="sleep-title">Sleep Architecture</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Recovery and restorative phases</p>
        </div>

        {isLoadingTrend ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : trendData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-primary/20 bg-card/50" data-testid="sleep-summary-duration">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-mono uppercase text-muted-foreground">Avg Duration</div>
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono">
                  {Math.floor(trendData.avgTotalMinutes / 60)}h {Math.round(trendData.avgTotalMinutes % 60)}m
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-card/50" data-testid="sleep-summary-efficiency">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-mono uppercase text-muted-foreground">Efficiency</div>
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono">
                  {Math.round(trendData.avgEfficiencyPct)}%
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-card/50" data-testid="sleep-summary-deep">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-mono uppercase text-muted-foreground">Avg Deep</div>
                  <Moon className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono">
                  {Math.floor(trendData.avgDeepMinutes / 60)}h {Math.round(trendData.avgDeepMinutes % 60)}m
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-card/50" data-testid="sleep-summary-debt">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-mono uppercase text-muted-foreground">Sleep Debt</div>
                  <Moon className="w-4 h-4 text-destructive" />
                </div>
                <div className="text-2xl font-bold font-mono text-destructive">
                  {Math.floor(trendData.sleepDebtMinutes / 60)}h {Math.round(trendData.sleepDebtMinutes % 60)}m
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-primary/20 bg-card/50" data-testid="sleep-trend-chart">
          <CardHeader>
            <CardTitle className="text-lg font-mono uppercase">30-Day Duration Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {isLoadingTrend ? (
              <Skeleton className="w-full h-full" />
            ) : trendData?.points && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData.points}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), 'MMM dd')} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    fontFamily="monospace"
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    fontFamily="monospace"
                    tickFormatter={(val) => `${Math.floor(val/60)}h`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--primary))', fontFamily: 'monospace' }}
                    labelFormatter={(val) => format(parseISO(val as string), 'MMM dd')}
                    formatter={(val: number) => [`${Math.floor(val/60)}h ${Math.round(val%60)}m`, 'Duration']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalMinutes" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-bold font-mono uppercase mb-4">Recent Sessions</h2>
          <div className="space-y-4">
            {isLoadingSessions ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : sessionsData?.map((session) => (
              <Card key={session.id} className="border-primary/20 bg-card/50" data-testid={`sleep-session-${session.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="font-mono text-sm text-muted-foreground uppercase">{format(parseISO(session.date), 'EEEE, MMM dd, yyyy')}</div>
                      <div className="font-bold font-mono text-xl mt-1">
                        {format(parseISO(session.onsetAt), 'HH:mm')} - {format(parseISO(session.wakeAt), 'HH:mm')}
                      </div>
                    </div>
                    
                    <div className="flex gap-6">
                      <div>
                        <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Total</div>
                        <div className="font-mono font-bold">{Math.floor(session.totalMinutes / 60)}h {Math.round(session.totalMinutes % 60)}m</div>
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase text-primary mb-1">Deep</div>
                        <div className="font-mono font-bold text-primary">{Math.floor(session.deepMinutes / 60)}h {Math.round(session.deepMinutes % 60)}m</div>
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase text-blue-400 mb-1">REM</div>
                        <div className="font-mono font-bold text-blue-400">{Math.floor(session.remMinutes / 60)}h {Math.round(session.remMinutes % 60)}m</div>
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Efficiency</div>
                        <div className="font-mono font-bold">{Math.round(session.efficiencyPct)}%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Visual Stage Bar */}
                  <div className="w-full h-3 bg-muted rounded-full mt-6 overflow-hidden flex">
                    <div style={{ width: `${(session.deepMinutes / session.totalMinutes) * 100}%` }} className="bg-primary h-full" title="Deep Sleep" />
                    <div style={{ width: `${(session.remMinutes / session.totalMinutes) * 100}%` }} className="bg-blue-500 h-full" title="REM Sleep" />
                    <div style={{ width: `${(session.lightMinutes / session.totalMinutes) * 100}%` }} className="bg-blue-300 h-full" title="Light Sleep" />
                    <div style={{ width: `${(session.awakeMinutes / session.totalMinutes) * 100}%` }} className="bg-destructive h-full" title="Awake" />
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground uppercase">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Deep</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> REM</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-300" /> Light</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Awake</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
