import { useState } from "react";
import { Layout } from "@/components/layout";
import { 
  useListInterventions, 
  getListInterventionsQueryKey,
  useUpdateIntervention
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { motion } from "framer-motion";
import { CheckSquare, XCircle, AlertTriangle, CheckCircle2, Clock, Check, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Interventions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  
  const { data: interventions, isLoading } = useListInterventions();
  
  const updateMutation = useUpdateIntervention({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInterventionsQueryKey() });
        toast.success("Protocol updated", {
          description: "System state has been recorded.",
        });
      },
      onError: () => {
        toast.error("Update failed", {
          description: "Could not modify the protocol. Please try again.",
        });
      }
    }
  });

  const handleUpdateStatus = (id: number, status: string) => {
    updateMutation.mutate({ id, data: { status } });
  };

  const filteredInterventions = interventions?.filter(
    i => statusFilter === "all" || i.status === statusFilter
  )?.sort((a, b) => {
    // Sort pending first
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  const getPriorityColor = (priority: string) => {
    // Priority might be derived from logic or a payload field, 
    // but we'll assign colors to standard terms if they exist
    return "bg-secondary text-secondary-foreground"; // Default
  };

  const getStatusIcon = (status: string) => {
    switch(status.toLowerCase()) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'skipped': return <XCircle className="w-5 h-5 text-muted-foreground" />;
      default: return <Clock className="w-5 h-5 text-primary" />;
    }
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
            <h1 className="text-3xl font-bold font-mono tracking-tight uppercase" data-testid="text-page-title">Active Protocols</h1>
            <p className="text-muted-foreground font-mono" data-testid="text-page-subtitle">Autonomous interventions and actionable directives</p>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] font-mono text-xs uppercase" data-testid="select-status">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Protocols</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border">
                <CardHeader className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
                <CardFooter className="gap-2">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </CardFooter>
              </Card>
            ))
          ) : filteredInterventions && filteredInterventions.length > 0 ? (
            filteredInterventions.map((intervention) => (
              <Card 
                key={intervention.id} 
                className={`bg-card/50 border-border relative overflow-hidden transition-all ${
                  intervention.status === 'completed' ? 'opacity-60 grayscale-[0.5]' : ''
                }`}
                data-testid={`card-intervention-${intervention.id}`}
              >
                {/* Decorative status bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  intervention.status === 'completed' ? 'bg-green-500' :
                  intervention.status === 'skipped' ? 'bg-muted' :
                  'bg-primary'
                }`} />

                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase bg-background">
                      {intervention.type}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground uppercase">
                        {intervention.status}
                      </span>
                      {getStatusIcon(intervention.status)}
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold uppercase tracking-tight">
                    {intervention.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pb-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Action
                    </div>
                    <p className="text-sm font-medium">{intervention.action}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Rationale
                    </div>
                    <p className="text-sm text-muted-foreground">{intervention.rationale}</p>
                  </div>

                  <div className="text-xs text-muted-foreground font-mono pt-2 border-t border-border">
                    Triggered: {format(new Date(intervention.triggeredAt), "MMM d, HH:mm")}
                  </div>
                </CardContent>
                
                {intervention.status === 'pending' && (
                  <CardFooter className="gap-3 pt-0">
                    <Button 
                      onClick={() => handleUpdateStatus(intervention.id, 'completed')}
                      disabled={updateMutation.isPending}
                      className="font-mono text-xs uppercase tracking-wider"
                      data-testid={`btn-complete-${intervention.id}`}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Execute
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleUpdateStatus(intervention.id, 'skipped')}
                      disabled={updateMutation.isPending}
                      className="font-mono text-xs uppercase tracking-wider border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      data-testid={`btn-skip-${intervention.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Override
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <Card className="bg-card/50 border-border p-12 text-center">
                <CheckSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="font-mono text-lg font-bold uppercase tracking-wider mb-2">No Active Protocols</h3>
                <p className="text-muted-foreground font-mono text-sm">
                  System state is nominal. No interventions required at this time.
                </p>
              </Card>
            </div>
          )}
        </div>
      </motion.div>
    </Layout>
  );
}
