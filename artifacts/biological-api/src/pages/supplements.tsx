import { useState } from "react";
import { useListSupplements } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beaker, Sunrise, Sunset, Utensils, Info } from "lucide-react";
import { motion } from "framer-motion";

type FilterTab = "all" | "active" | "inactive";
const FILTER_TABS: FilterTab[] = ["all", "active", "inactive"];

export default function Supplements() {
  const { data: supplements, isLoading } = useListSupplements();
  const [filter, setFilter] = useState<FilterTab>("active");

  const handleFilterChange = (v: string) => {
    if (FILTER_TABS.includes(v as FilterTab)) setFilter(v as FilterTab);
  };

  const filteredSupplements = supplements?.filter((s) => {
    if (filter === "all") return true;
    if (filter === "active") return s.active;
    return !s.active;
  });

  const getTimingIcon = (timing: string) => {
    const t = timing.toLowerCase();
    if (t.includes("morning")) return Sunrise;
    if (t.includes("evening") || t.includes("night")) return Sunset;
    if (t.includes("meal")) return Utensils;
    return Beaker;
  };

  const groupSupplements = (supps: typeof supplements) => {
    if (!supps) return {};
    return supps.reduce((acc, curr) => {
      const timing = curr.timing || "other";
      if (!acc[timing]) acc[timing] = [];
      acc[timing].push(curr);
      return acc;
    }, {} as Record<string, typeof supplements>);
  };

  const grouped = groupSupplements(filteredSupplements);

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold uppercase tracking-wider mb-2">Protocols</h1>
            <p className="text-muted-foreground font-mono text-sm">Active supplementation and compound intake schedule.</p>
          </div>
          
          <Tabs defaultValue="active" onValueChange={handleFilterChange} className="w-full md:w-auto">
            <TabsList className="font-mono bg-card border border-border">
              <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
              <TabsTrigger value="inactive" data-testid="tab-inactive">Archived</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-10 w-48" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        ) : filteredSupplements?.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center flex flex-col items-center justify-center">
            <Beaker className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-mono font-bold text-lg mb-2">No protocols found</h3>
            <p className="text-muted-foreground font-mono text-sm">No supplements matching the current filter.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(grouped).map(([timing, supps]) => {
              if (!supps) return null;
              const TimingIcon = getTimingIcon(timing);
              return (
                <div key={timing} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <TimingIcon className="w-5 h-5 text-primary" />
                    <h2 className="font-mono font-bold text-xl uppercase tracking-wider">{timing}</h2>
                    <Badge variant="outline" className="ml-2 font-mono">{supps.length}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {supps.map((supp) => (
                      <div 
                        key={supp.id} 
                        className={`border bg-card p-5 flex flex-col rounded-lg transition-all ${
                          supp.active ? "border-border hover:border-primary/50" : "border-border/50 opacity-60"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-mono font-bold text-lg">{supp.name}</h3>
                          {!supp.active && <Badge variant="secondary" className="text-[10px]">INACTIVE</Badge>}
                          {supp.recommendedByAi && <Badge variant="default" className="bg-primary/20 text-primary border-primary/30 text-[10px]">AI REC</Badge>}
                        </div>
                        
                        <div className="font-mono text-xl text-primary mb-4">
                          {supp.doseMg} <span className="text-sm text-muted-foreground">mg</span>
                        </div>
                        
                        {supp.rationale && (
                          <div className="mt-auto pt-4 border-t border-border/50 flex items-start gap-2 text-xs text-muted-foreground font-mono">
                            <Info className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2" title={supp.rationale}>{supp.rationale}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
