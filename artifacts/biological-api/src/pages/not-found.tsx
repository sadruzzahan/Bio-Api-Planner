import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,100,100,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,100,100,0.15)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center px-6 max-w-md"
        data-testid="not-found-page"
      >
        <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase mb-12 justify-center">
          <Activity className="w-5 h-5" />
          <span>BioOS</span>
        </div>

        <div className="w-20 h-20 bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive mx-auto mb-8">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <div className="font-mono text-6xl font-bold text-destructive/30 mb-4">404</div>
        <h1 className="text-2xl font-mono font-bold uppercase tracking-tight mb-3">Route Not Found</h1>
        <p className="text-muted-foreground font-mono text-sm mb-10">
          The telemetry route you requested does not exist in this system. Return to mission control.
        </p>

        <Link href="/dashboard">
          <Button className="font-mono uppercase tracking-wider" data-testid="btn-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
