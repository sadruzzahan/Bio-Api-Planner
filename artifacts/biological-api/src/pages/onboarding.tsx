import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateCurrentUser,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Target, Wifi, Clock, Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const WEARABLES = [
  { id: "whoop", label: "WHOOP" },
  { id: "oura", label: "Oura Ring" },
  { id: "apple_health", label: "Apple Health" },
  { id: "fitbit", label: "Fitbit" },
  { id: "none", label: "None yet" },
];

const CHRONOTYPES = [
  { id: "early_bird", label: "Early Bird", sub: "Natural peak before noon" },
  { id: "intermediate", label: "Intermediate", sub: "Peak mid-day, flexible" },
  { id: "night_owl", label: "Night Owl", sub: "Natural peak after 8pm" },
  { id: "dolphin", label: "Dolphin", sub: "Light sleeper, irregular schedule" },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const updateUser = useUpdateCurrentUser();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [wearable, setWearable] = useState("");
  const [chronotype, setChronotype] = useState("");
  const [loading, setLoading] = useState(false);

  // If the user has already onboarded, skip straight to the dashboard.
  useEffect(() => {
    if (user?.onboardedAt) navigate("/dashboard", { replace: true });
  }, [user?.onboardedAt, navigate]);

  const handleFinish = async () => {
    setLoading(true);
    try {
      await updateUser.mutateAsync({
        data: {
          chronotype,
          primaryGoal: goal,
          onboardedAt: new Date().toISOString(),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      // Brief delay for the "running assessment" animation
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      setLoading(false);
      toast.error("Couldn't save your profile. Please try again.");
    }
  };

  const steps = [
    {
      id: "goals",
      title: "Define Mission Objective",
      subtitle: "What do you want to optimize?",
      icon: Target,
    },
    {
      id: "wearable",
      title: "Connect Telemetry",
      subtitle: "Which device will supply your data?",
      icon: Wifi,
    },
    {
      id: "chronotype",
      title: "Chronotype Profile",
      subtitle: "When does your body naturally perform best?",
      icon: Clock,
    },
    {
      id: "assessment",
      title: "Initializing System",
      subtitle: "Running your first biological assessment...",
      icon: Activity,
    },
  ];

  const canAdvance = () => {
    if (step === 0) return goal.trim().length > 3;
    if (step === 1) return wearable !== "";
    if (step === 2) return chronotype !== "";
    return true;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(0,184,212,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(0,184,212,0.2)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="w-full max-w-lg px-6 relative z-10">
        <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase mb-12 justify-center">
          <Activity className="w-6 h-6" />
          <span className="text-xl">BioOS</span>
        </div>

        <div className="flex items-center gap-2 mb-8 justify-center">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "border-2 border-primary text-primary" :
                "border border-border text-muted-foreground"
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px w-8 transition-all ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {!loading ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="bg-card border border-border p-8 space-y-6"
            >
              <div>
                <h2 className="text-2xl font-mono font-bold uppercase tracking-tight">{steps[step].title}</h2>
                <p className="text-muted-foreground font-mono text-sm mt-2">{steps[step].subtitle}</p>
              </div>

              {step === 0 && (
                <div className="space-y-3">
                  {["Maximize athletic performance", "Improve sleep quality", "Stabilize glucose & metabolic health", "Reduce stress and improve recovery"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setGoal(opt)}
                      className={`w-full text-left px-4 py-3 border rounded-md font-mono text-sm transition-all ${
                        goal === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground"
                      }`}
                      data-testid={`opt-goal-${opt.toLowerCase().replace(/ /g, "-")}`}
                    >
                      {opt}
                    </button>
                  ))}
                  <Input
                    className="font-mono bg-background border-border mt-2"
                    placeholder="Or describe your own goal..."
                    value={["Maximize athletic performance", "Improve sleep quality", "Stabilize glucose & metabolic health", "Reduce stress and improve recovery"].includes(goal) ? "" : goal}
                    onChange={(e) => setGoal(e.target.value)}
                    data-testid="input-custom-goal"
                  />
                </div>
              )}

              {step === 1 && (
                <div className="grid grid-cols-2 gap-3">
                  {WEARABLES.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWearable(w.id)}
                      className={`px-4 py-3 border rounded-md font-mono text-sm text-left transition-all ${
                        wearable === w.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground"
                      }`}
                      data-testid={`opt-wearable-${w.id}`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  {CHRONOTYPES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChronotype(c.id)}
                      className={`w-full text-left px-4 py-3 border rounded-md transition-all ${
                        chronotype === c.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                      }`}
                      data-testid={`opt-chronotype-${c.id}`}
                    >
                      <div className={`font-mono font-bold text-sm ${chronotype === c.id ? "text-primary" : "text-foreground"}`}>{c.label}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">{c.sub}</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                {step > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} className="font-mono text-xs uppercase" data-testid="btn-back">
                    <ArrowLeft className="w-3 h-3 mr-2" /> Back
                  </Button>
                ) : <div />}
                <Button
                  onClick={() => step < 2 ? setStep(s => s + 1) : handleFinish()}
                  disabled={!canAdvance()}
                  className="font-mono uppercase tracking-wider"
                  data-testid="btn-next"
                >
                  {step < 2 ? "Continue" : "Launch System"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-border p-12 flex flex-col items-center justify-center gap-6 text-center"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div>
                <h2 className="text-xl font-mono font-bold uppercase tracking-tight">Running First Assessment</h2>
                <p className="text-muted-foreground font-mono text-sm mt-2">Calibrating your biological baseline...</p>
              </div>
              <div className="w-full bg-border rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.3, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
