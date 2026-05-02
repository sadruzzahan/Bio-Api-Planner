import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, ShieldCheck, Database, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Decorative grid */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(0,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      <div className="flex-1 flex flex-col items-center justify-center container mx-auto px-6 py-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="w-20 h-20 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-8 mx-auto">
            <Activity className="w-10 h-10" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-mono font-bold uppercase tracking-tight mb-4">
            System Initialization
          </h1>
          <p className="text-muted-foreground font-mono text-lg">
            Welcome to BioOS. Your mission control for human optimization. Connect your telemetry sources to begin.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-card border border-border p-6"
          >
            <Database className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-mono font-bold uppercase mb-2">Ingest Data</h3>
            <p className="text-sm text-muted-foreground font-mono">Connect wearables and continuous monitors to stream metrics.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-card border border-border p-6"
          >
            <Zap className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-mono font-bold uppercase mb-2">Identify Patterns</h3>
            <p className="text-sm text-muted-foreground font-mono">AI-driven insights analyzing correlation between sleep, strain, and glucose.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-card border border-border p-6"
          >
            <ShieldCheck className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-mono font-bold uppercase mb-2">Execute Interventions</h3>
            <p className="text-sm text-muted-foreground font-mono">Receive actionable protocols to shift your biological state.</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Link href="/dashboard">
            <Button size="lg" className="h-14 px-8 font-mono uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 rounded-none border border-transparent hover:border-primary transition-all group" data-testid="btn-enter-dashboard">
              Enter Mission Control
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
