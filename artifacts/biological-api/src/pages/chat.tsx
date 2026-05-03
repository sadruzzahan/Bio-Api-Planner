import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChatHistory, useSendChatMessage, getGetChatHistoryQueryKey,
  useGetCurrentState, useGetBiometricsSummary,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Activity, User, Bot, Brain, Heart, Zap, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { MedicalDisclaimerPill, ChatFirstSessionDisclaimer } from "@/components/medical-disclaimer";

const fmt1 = (v: number | null | undefined) => v != null ? Number(v).toFixed(1) : "--";

const FIRST_SESSION_KEY = "bioos.chat.disclaimer.acknowledged";

export default function Chat() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFirstSessionBanner, setShowFirstSessionBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(FIRST_SESSION_KEY) !== "1";
  });

  const { data: messages, isLoading } = useGetChatHistory({ limit: 100 });
  const sendChat = useSendChatMessage();
  const { data: state } = useGetCurrentState();
  const { data: summaries } = useGetBiometricsSummary();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendChat.mutate({ data: { message: input.trim() } }, {
      onSuccess: () => {
        setInput("");
        queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
      },
      onError: () => {
        // keep input so user can retry; error bubble rendered below
      },
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendChat.isPending]);

  const stateColorClass = (() => {
    const s = state?.energyState?.toLowerCase();
    if (s === "peak" || s === "optimal") return "text-green-400 border-green-400/30 bg-green-400/5";
    if (s === "moderate") return "text-yellow-400 border-yellow-400/30 bg-yellow-400/5";
    if (s === "fatigued" || s === "stressed") return "text-orange-400 border-orange-400/30 bg-orange-400/5";
    return "text-primary border-primary/30 bg-primary/5";
  })();

  const contextMetrics = summaries?.slice(0, 4) ?? [];

  const METRIC_ICONS: Record<string, React.ElementType> = {
    hrv_rmssd: Heart,
    resting_hr: Activity,
    recovery_score: Zap,
    spo2: Moon,
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]"
        data-testid="chat-layout"
      >
        {/* Context Panel */}
        <aside className="lg:w-72 shrink-0 flex flex-col gap-3">
          <div className="border border-border bg-card p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="font-mono font-bold uppercase tracking-wider text-xs">Biological State</h3>
            </div>
            {state ? (
              <div className={`rounded-md border px-3 py-2 font-mono ${stateColorClass}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider">{state.energyState}</span>
                  <span className="text-lg font-bold">{state.readinessScore}%</span>
                </div>
                <div className="mt-1 h-1 bg-border/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-current opacity-70"
                    style={{ width: `${state.readinessScore}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs opacity-80">
                  <span className="text-muted-foreground">Recovery</span>
                  <span className="text-right font-bold capitalize">{state.recoveryState}</span>
                  <span className="text-muted-foreground">Stress</span>
                  <span className="text-right font-bold capitalize">{state.stressState}</span>
                  <span className="text-muted-foreground">Cognitive</span>
                  <span className="text-right font-bold capitalize">{state.cognitiveState}</span>
                  <span className="text-muted-foreground">Metabolic</span>
                  <span className="text-right font-bold capitalize">{state.metabolicState}</span>
                </div>
              </div>
            ) : (
              <Skeleton className="h-20 w-full" />
            )}
          </div>

          <div className="border border-border bg-card p-4 rounded-lg flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-mono font-bold uppercase tracking-wider text-xs">Live Telemetry</h3>
            </div>
            <div className="space-y-3">
              {contextMetrics.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : contextMetrics.map((m) => {
                const Icon = METRIC_ICONS[m.metric] ?? Activity;
                return (
                  <div key={m.metric} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground uppercase">{m.metric.replace(/_/g, " ")}</span>
                    </div>
                    <div className="font-mono text-sm font-bold">
                      {fmt1(m.latest)}<span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col border border-border bg-card/30 rounded-lg overflow-hidden min-h-0">
          <div className="p-4 border-b border-border bg-card flex items-center gap-2 shrink-0">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="font-mono font-bold uppercase tracking-wider text-sm">BioOS Assistant</h2>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                    <Skeleton className="h-16 w-64 rounded-lg" />
                  </div>
                ))
              ) : messages?.length === 0 ? (
                <div className="text-center text-muted-foreground font-mono py-10 flex flex-col items-center justify-center" data-testid="chat-empty">
                  <Bot className="w-12 h-12 mb-4 opacity-50" />
                  <p>System initialized.</p>
                  <p className="text-sm mt-2 opacity-70">Ask about your biometrics, sleep patterns, or glucose trends.</p>
                </div>
              ) : (
                messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg p-4 font-mono text-sm ${
                      msg.role === "user"
                        ? "bg-primary/20 text-foreground border border-primary/30"
                        : "bg-card border border-border"
                    }`}>
                      <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase opacity-50">
                        {msg.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                        <span>{msg.role}</span>
                      </div>
                      <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      {msg.role !== "user" && <MedicalDisclaimerPill />}
                    </div>
                  </div>
                ))
              )}

              {sendChat.isPending && (
                <div className="flex justify-start" data-testid="chat-pending">
                  <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-50 mb-2">
                      <Bot className="w-3 h-3" />
                      <span>assistant</span>
                    </div>
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    <MedicalDisclaimerPill />
                  </div>
                </div>
              )}

              {sendChat.isError && (
                <div className="flex justify-start" data-testid="chat-error">
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 font-mono text-sm max-w-[85%]">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-destructive mb-2">
                      <Bot className="w-3 h-3" />
                      <span>system error</span>
                    </div>
                    <p className="text-destructive/80 text-xs">
                      Failed to deliver message. Check connection and retry.
                    </p>
                    <button
                      onClick={handleSend.bind(null, { preventDefault: () => {} } as React.FormEvent)}
                      className="mt-2 font-mono text-[10px] uppercase tracking-wider text-destructive hover:text-destructive/70 underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border bg-card shrink-0">
            {showFirstSessionBanner && (
              <ChatFirstSessionDisclaimer
                onDismiss={() => {
                  try {
                    localStorage.setItem(FIRST_SESSION_KEY, "1");
                  } catch {
                    /* ignore — banner just won't persist dismissal */
                  }
                  setShowFirstSessionBanner(false);
                }}
              />
            )}
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query telemetry data..."
                className="font-mono bg-background border-primary/30 focus-visible:ring-primary/50"
                disabled={sendChat.isPending}
                data-testid="input-chat"
              />
              <Button
                type="submit"
                size="icon"
                disabled={sendChat.isPending || !input.trim()}
                className="font-mono bg-primary text-primary-foreground hover:bg-primary/80 shrink-0"
                data-testid="button-send-chat"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
