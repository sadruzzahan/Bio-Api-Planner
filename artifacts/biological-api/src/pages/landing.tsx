import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Activity, Brain, ShieldAlert, Zap, Cpu, Database, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const TIERS = [
  {
    name: "Basic",
    price: "$29",
    period: "/mo",
    description: "Self-directed optimization with core biometric tracking.",
    features: ["HRV, sleep & glucose dashboard", "7-day trend analysis", "Manual supplement logging", "Up to 2 wearable integrations"],
    cta: "Start Basic",
    highlighted: false,
  },
  {
    name: "Optimize",
    price: "$79",
    period: "/mo",
    description: "AI-driven protocols and automated intervention engine.",
    features: ["Everything in Basic", "AI-generated daily interventions", "Unlimited integrations", "30-day rolling comparisons", "BioOS chat assistant"],
    cta: "Start Optimize",
    highlighted: true,
  },
  {
    name: "Elite",
    price: "$199",
    period: "/mo",
    description: "Full mission control with advanced AI coaching and priority support.",
    features: ["Everything in Optimize", "Chronotype-optimized scheduling", "Custom AI protocols", "CGM & lab test sync", "Priority support"],
    cta: "Start Elite",
    highlighted: false,
  },
];

const LAYERS = [
  {
    step: "01",
    label: "Sensing",
    icon: Cpu,
    desc: "Ingest continuous data from wearables, CGMs, lab tests, and smart home sensors in real time.",
  },
  {
    step: "02",
    label: "Model",
    icon: Database,
    desc: "Build a dynamic biological model from your HRV, sleep stages, glucose variability, and activity load.",
  },
  {
    step: "03",
    label: "Actuation",
    icon: Zap,
    desc: "Generate autonomous interventions — timed supplements, sleep cues, workout prescriptions — tuned to your state.",
  },
  {
    step: "04",
    label: "Interface",
    icon: Brain,
    desc: "A mission control dashboard surfaces every insight with full context so you execute with confidence.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <header className="container mx-auto px-6 h-20 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase">
          <Activity className="w-5 h-5" />
          <span>BioOS</span>
        </div>
        <nav className="flex items-center gap-6">
          <a href="#pricing" className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <Link href="/sign-in">
            <Button size="sm" variant="ghost" className="font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground" data-testid="link-signin">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="font-mono uppercase tracking-wider" data-testid="link-signup">
              Get Started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center container mx-auto px-6 py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-8 uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              System Online
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter max-w-4xl mx-auto font-mono uppercase mb-6 leading-tight">
              Telemetry for the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
                Human Machine
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-mono">
              A biological operating system. Unify your HRV, sleep stages, and glucose variability into a single command center.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="font-mono uppercase tracking-wider h-14 px-8 rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 group"
                  data-testid="btn-start"
                >
                  Initialize System
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-mono uppercase tracking-wider h-14 px-8 rounded-none border border-border text-muted-foreground hover:text-foreground"
                  data-testid="btn-signin-hero"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* 4-Layer Architecture */}
        <section className="container mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-mono font-bold uppercase tracking-tight mb-3">How BioOS Works</h2>
            <p className="text-muted-foreground font-mono text-sm max-w-xl mx-auto">Four-layer closed-loop system continuously optimizing your biology.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {LAYERS.map((layer, i) => {
              const Icon = layer.icon;
              return (
                <motion.div
                  key={layer.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="border border-border bg-card/50 p-6 relative"
                  data-testid={`layer-${layer.label.toLowerCase()}`}
                >
                  <div className="font-mono text-4xl font-bold text-primary/10 absolute top-4 right-4">{layer.step}</div>
                  <Icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="font-mono text-base font-bold mb-2 uppercase">{layer.label}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{layer.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Features Row */}
        <section className="container mx-auto px-6 py-12 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border border-border bg-card/50 p-6">
              <Brain className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-mono text-lg font-bold mb-2 uppercase">Cognitive Load</h3>
              <p className="text-sm text-muted-foreground font-mono">Track recovery and mental readiness to optimize deep work phases.</p>
            </div>
            <div className="border border-border bg-card/50 p-6">
              <ShieldAlert className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-mono text-lg font-bold mb-2 uppercase">Metabolic State</h3>
              <p className="text-sm text-muted-foreground font-mono">Real-time glucose variability and fueling protocols.</p>
            </div>
            <div className="border border-border bg-card/50 p-6">
              <Zap className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-mono text-lg font-bold mb-2 uppercase">System Strain</h3>
              <p className="text-sm text-muted-foreground font-mono">Zone-2 mapping, CNS fatigue, and autonomous interventions.</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container mx-auto px-6 py-24 border-t border-border">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-mono font-bold uppercase tracking-tight mb-3">Clearance Levels</h2>
            <p className="text-muted-foreground font-mono text-sm max-w-xl mx-auto">Choose the level of biological intelligence that matches your mission.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`border p-8 flex flex-col relative ${
                  tier.highlighted
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card/50"
                }`}
                data-testid={`pricing-${tier.name.toLowerCase()}`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-mono uppercase px-3 py-1 tracking-widest">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <div className="font-mono font-bold uppercase tracking-widest text-sm text-muted-foreground mb-2">{tier.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-mono font-bold">{tier.price}</span>
                    <span className="text-muted-foreground font-mono text-sm">{tier.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-3">{tier.description}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-8">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 font-mono text-xs">
                      <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up">
                  <Button
                    variant={tier.highlighted ? "default" : "outline"}
                    className={`w-full font-mono uppercase tracking-wider ${tier.highlighted ? "" : "border-border"}`}
                    data-testid={`btn-tier-${tier.name.toLowerCase()}`}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 container mx-auto px-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase text-sm">
          <Activity className="w-4 h-4" />
          <span>BioOS</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono">Mission Control for Human Performance</p>
      </footer>
    </div>
  );
}
