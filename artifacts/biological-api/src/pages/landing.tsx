import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Activity, Brain, ShieldAlert, Zap } from "lucide-react";
import { useGetCurrentUser } from "@workspace/api-client-react";

export default function Landing() {
  const { data: user, isLoading } = useGetCurrentUser();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Decorative noise/grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      <header className="container mx-auto px-6 h-20 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase">
          <Activity className="w-5 h-5" />
          <span>BioOS</span>
        </div>
        <nav>
          {isLoading ? null : user ? (
            <Link href="/dashboard" className="text-sm font-medium text-primary hover:text-primary/80" data-testid="link-dashboard">
              ENTER MISSION CONTROL
            </Link>
          ) : (
            <Link href="/onboarding" className="text-sm font-medium text-muted-foreground hover:text-foreground" data-testid="link-onboarding">
              INITIALIZE
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center container mx-auto px-6 relative z-10 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-8 uppercase">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          System Online
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter max-w-4xl font-mono uppercase mb-6 leading-tight">
          Telemetry for the <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Human Machine</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-mono">
          A biological operating system. Unify your HRV, sleep stages, and glucose variability into a single command center. 
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/dashboard">
            <Button size="lg" className="font-mono uppercase tracking-wider h-14 px-8 rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300" data-testid="btn-start">
              Initialize System
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto w-full text-left">
          <div className="border border-border bg-card/50 p-6">
            <Brain className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-mono text-lg font-bold mb-2 uppercase">Cognitive Load</h3>
            <p className="text-sm text-muted-foreground">Track recovery and mental readiness to optimize deep work phases.</p>
          </div>
          <div className="border border-border bg-card/50 p-6">
            <ShieldAlert className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-mono text-lg font-bold mb-2 uppercase">Metabolic State</h3>
            <p className="text-sm text-muted-foreground">Real-time glucose variability and fueling protocols.</p>
          </div>
          <div className="border border-border bg-card/50 p-6">
            <Zap className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-mono text-lg font-bold mb-2 uppercase">System Strain</h3>
            <p className="text-sm text-muted-foreground">Zone-2 mapping, CNS fatigue, and autonomous interventions.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
