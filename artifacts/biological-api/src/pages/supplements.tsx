import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSupplements, useCreateSupplement, useUpdateSupplement, useDeleteSupplement,
  getListSupplementsQueryKey,
} from "@workspace/api-client-react";
import type { Supplement } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Beaker, Sunrise, Sunset, Utensils, Info, Plus, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type FilterTab = "all" | "active" | "inactive";
const FILTER_TABS: FilterTab[] = ["all", "active", "inactive"];

const TIMING_OPTIONS = ["morning", "afternoon", "evening", "with_meal", "pre_workout", "post_workout", "bedtime"];

interface SupplementForm {
  name: string;
  doseMg: number | "";
  timing: string;
}

const EMPTY_FORM: SupplementForm = { name: "", doseMg: "", timing: "morning" };

export default function Supplements() {
  const queryClient = useQueryClient();
  const { data: supplements, isLoading } = useListSupplements();
  const createSupplement = useCreateSupplement();
  const updateSupplement = useUpdateSupplement();
  const deleteSupplement = useDeleteSupplement();

  const [filter, setFilter] = useState<FilterTab>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplement | null>(null);
  const [form, setForm] = useState<SupplementForm>(EMPTY_FORM);

  const handleFilterChange = (v: string) => {
    if (FILTER_TABS.includes(v as FilterTab)) setFilter(v as FilterTab);
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (supp: Supplement) => {
    setEditTarget(supp);
    setForm({ name: supp.name, doseMg: supp.doseMg, timing: supp.timing });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || form.doseMg === "") return;
    const doseMg = Number(form.doseMg);
    if (editTarget) {
      updateSupplement.mutate({ id: editTarget.id, data: { name: form.name.trim(), doseMg, timing: form.timing } }, {
        onSuccess: () => {
          toast.success("Supplement updated");
          queryClient.invalidateQueries({ queryKey: getListSupplementsQueryKey() });
          setDialogOpen(false);
        },
        onError: () => toast.error("Failed to update supplement"),
      });
    } else {
      createSupplement.mutate({ data: { name: form.name.trim(), doseMg, timing: form.timing } }, {
        onSuccess: () => {
          toast.success("Supplement added");
          queryClient.invalidateQueries({ queryKey: getListSupplementsQueryKey() });
          setDialogOpen(false);
        },
        onError: () => toast.error("Failed to add supplement"),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteSupplement.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        toast.success("Supplement removed");
        queryClient.invalidateQueries({ queryKey: getListSupplementsQueryKey() });
        setDeleteTarget(null);
      },
      onError: () => toast.error("Failed to remove supplement"),
    });
  };

  const handleToggleActive = (supp: Supplement) => {
    updateSupplement.mutate({ id: supp.id, data: { active: !supp.active } }, {
      onSuccess: () => {
        toast.success(supp.active ? "Supplement archived" : "Supplement activated");
        queryClient.invalidateQueries({ queryKey: getListSupplementsQueryKey() });
      },
      onError: () => toast.error("Failed to update status"),
    });
  };

  const filteredSupplements = supplements?.filter(s => {
    if (filter === "all") return true;
    if (filter === "active") return s.active;
    return !s.active;
  });

  const getTimingIcon = (timing: string) => {
    const t = timing.toLowerCase();
    if (t.includes("morning") || t.includes("pre")) return Sunrise;
    if (t.includes("evening") || t.includes("night") || t.includes("bedtime") || t.includes("post")) return Sunset;
    if (t.includes("meal") || t.includes("afternoon")) return Utensils;
    return Beaker;
  };

  const grouped = filteredSupplements
    ? filteredSupplements.reduce((acc, s) => {
        const key = s.timing || "other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {} as Record<string, Supplement[]>)
    : {};

  const isMutating = createSupplement.isPending || updateSupplement.isPending;

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold uppercase tracking-wider mb-1">Protocols</h1>
            <p className="text-muted-foreground font-mono text-sm">Active supplementation and compound intake schedule.</p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs defaultValue="active" onValueChange={handleFilterChange} className="w-full md:w-auto">
              <TabsList className="font-mono bg-card border border-border">
                <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
                <TabsTrigger value="inactive" data-testid="tab-inactive">Archived</TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              onClick={openCreate}
              className="font-mono uppercase tracking-wider shrink-0"
              data-testid="btn-add-supplement"
            >
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : filteredSupplements?.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center flex flex-col items-center justify-center">
            <Beaker className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-mono font-bold text-lg mb-2">No protocols found</h3>
            <p className="text-muted-foreground font-mono text-sm mb-6">No supplements matching the current filter.</p>
            <Button onClick={openCreate} variant="outline" className="font-mono uppercase">
              <Plus className="w-4 h-4 mr-2" /> Add First Supplement
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([timing, supps]) => {
              const TimingIcon = getTimingIcon(timing);
              return (
                <div key={timing} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <TimingIcon className="w-5 h-5 text-primary" />
                    <h2 className="font-mono font-bold text-lg uppercase tracking-wider">{timing.replace(/_/g, " ")}</h2>
                    <Badge variant="outline" className="ml-2 font-mono text-xs">{supps.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {supps.map(supp => (
                      <div
                        key={supp.id}
                        className={`border bg-card p-5 flex flex-col rounded-lg transition-all ${
                          supp.active ? "border-border hover:border-primary/40" : "border-border/50 opacity-60"
                        }`}
                        data-testid={`card-supp-${supp.id}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-mono font-bold text-base">{supp.name}</h3>
                          <div className="flex items-center gap-1">
                            {supp.recommendedByAi && (
                              <Badge variant="default" className="bg-primary/20 text-primary border-primary/30 text-[10px]">AI</Badge>
                            )}
                            {!supp.active && (
                              <Badge variant="secondary" className="text-[10px]">ARCHIVED</Badge>
                            )}
                          </div>
                        </div>

                        <div className="font-mono text-2xl text-primary mb-1">
                          {supp.doseMg} <span className="text-xs text-muted-foreground">mg</span>
                        </div>

                        {supp.rationale && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground font-mono mb-3">
                            <Info className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{supp.rationale}</span>
                          </div>
                        )}

                        <div className="mt-auto pt-3 border-t border-border/50 flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-mono text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(supp)}
                            data-testid={`btn-edit-${supp.id}`}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-mono text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleActive(supp)}
                            data-testid={`btn-toggle-${supp.id}`}
                          >
                            {supp.active ? "Archive" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-mono text-xs h-7 px-2 text-destructive hover:text-destructive ml-auto"
                            onClick={() => setDeleteTarget(supp)}
                            data-testid={`btn-delete-${supp.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider">{editTarget ? "Edit Supplement" : "Add Supplement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="uppercase text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Magnesium Glycinate"
                className="font-mono bg-background"
                data-testid="input-supp-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="uppercase text-xs">Dose (mg)</Label>
              <Input
                type="number"
                value={form.doseMg}
                onChange={e => setForm(f => ({ ...f, doseMg: e.target.value === "" ? "" : Number(e.target.value) }))}
                placeholder="e.g. 400"
                className="font-mono bg-background"
                data-testid="input-supp-dose"
              />
            </div>
            <div className="space-y-2">
              <Label className="uppercase text-xs">Timing</Label>
              <Select value={form.timing} onValueChange={v => setForm(f => ({ ...f, timing: v }))}>
                <SelectTrigger className="font-mono bg-background" data-testid="select-supp-timing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMING_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="font-mono uppercase text-xs">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || form.doseMg === "" || isMutating}
              className="font-mono uppercase tracking-wider"
              data-testid="btn-save-supplement"
            >
              {isMutating ? "Saving..." : editTarget ? "Save Changes" : "Add Supplement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase">Remove Supplement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> from your stack.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono uppercase text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono uppercase text-xs"
              data-testid="btn-confirm-delete"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
