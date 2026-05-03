import { useState } from "react";
import { useListBiometrics, useGetBiometricsSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Filter } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layout } from "@/components/layout";

const fmt1 = (v: number | null | undefined) => v != null ? Number(v).toFixed(1) : "--";

const RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export default function Biometrics() {
  const [selectedMetric, setSelectedMetric] = useState<string>("hrv_rmssd");
  const [rangeDays, setRangeDays] = useState<number>(30);

  const fromDate = subDays(new Date(), rangeDays).toISOString();

  const { data: summaryData, isLoading: isLoadingSummary } = useGetBiometricsSummary();
  const { data: entriesData, isLoading: isLoadingEntries } = useListBiometrics({
    metric: selectedMetric !== "all" ? selectedMetric : undefined,
    from: fromDate,
    limit: 200,
  });

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight uppercase" data-testid="biometrics-title">Biometrics</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Raw physiological telemetry</p>
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1 shrink-0" data-testid="range-toggle">
            {RANGE_OPTIONS.map(({ label, days }) => (
              <Button
                key={days}
                variant={rangeDays === days ? "default" : "ghost"}
                size="sm"
                onClick={() => setRangeDays(days)}
                className={`font-mono text-xs px-3 h-7 uppercase tracking-wider ${rangeDays === days ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                data-testid={`btn-range-${label.toLowerCase()}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        {isLoadingSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {summaryData?.slice(0, 3).map((summary) => (
              <Card key={summary.metric} className="border-primary/20 bg-card/50" data-testid={`summary-${summary.metric}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium font-mono uppercase text-muted-foreground">{summary.metric.replace(/_/g, " ")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono">{fmt1(summary.latest)}</span>
                    <span className="text-sm font-mono text-muted-foreground">{summary.unit}</span>
                  </div>
                  <div className="mt-2 text-xs font-mono text-muted-foreground flex gap-4">
                    <span>7d Avg: {summary.sevenDayAvg?.toFixed(1) || "-"}</span>
                    <span>30d Avg: {summary.thirtyDayAvg?.toFixed(1) || "-"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-mono uppercase flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Time Series — Last {rangeDays} Days
          </h2>
          <div className="flex items-center gap-2" data-testid="biometrics-filter">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-[180px] font-mono text-sm uppercase">
                <SelectValue placeholder="Select Metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Metrics</SelectItem>
                <SelectItem value="hrv_rmssd">HRV (RMSSD)</SelectItem>
                <SelectItem value="resting_hr">Resting HR</SelectItem>
                <SelectItem value="spo2">SpO2</SelectItem>
                <SelectItem value="recovery_score">Recovery Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chart */}
        <Card className="border-primary/20 bg-card/50" data-testid="biometrics-chart">
          <CardContent className="p-6 h-[400px]">
            {isLoadingEntries ? (
              <Skeleton className="w-full h-full" />
            ) : entriesData && entriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...entriesData].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="recordedAt"
                    tickFormatter={(val) => format(parseISO(val), "MMM dd")}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    fontFamily="monospace"
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    fontFamily="monospace"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--primary))", fontFamily: "monospace" }}
                    labelFormatter={(val) => format(parseISO(val as string), "MMM dd, HH:mm")}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground font-mono">No data available for selected metric.</div>
            )}
          </CardContent>
        </Card>

        {/* List */}
        <Card className="border-primary/20 bg-card/50 overflow-hidden" data-testid="biometrics-table">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono uppercase text-xs">Date</TableHead>
                <TableHead className="font-mono uppercase text-xs">Metric</TableHead>
                <TableHead className="font-mono uppercase text-xs text-right">Value</TableHead>
                <TableHead className="font-mono uppercase text-xs text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingEntries ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : entriesData?.map((entry) => (
                <TableRow key={entry.id} className="border-border font-mono text-sm" data-testid={`biometric-row-${entry.id}`}>
                  <TableCell>{format(parseISO(entry.recordedAt), "MMM dd, HH:mm")}</TableCell>
                  <TableCell className="uppercase text-muted-foreground">{entry.metric.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right font-bold text-foreground">
                    {entry.value} <span className="text-xs text-muted-foreground font-normal">{entry.unit}</span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{entry.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </motion.div>
    </AnimatePresence>
    </Layout>
  );
}
