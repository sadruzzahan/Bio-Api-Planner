import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetChatHistory, useSendChatMessage, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Activity, User, Bot } from "lucide-react";
import { motion } from "framer-motion";

export default function Chat() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useGetChatHistory({ limit: 100 });
  const sendChat = useSendChatMessage();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendChat.mutate({ data: { message: input.trim() } }, {
      onSuccess: () => {
        setInput("");
        queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
      }
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendChat.isPending]);

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] border border-border bg-card/30 rounded-lg overflow-hidden"
      >
        <div className="p-4 border-b border-border bg-card flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="font-mono font-bold uppercase tracking-wider text-sm">BioOS Assistant</h2>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="flex flex-col gap-4 max-w-3xl mx-auto pb-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <Skeleton className="h-16 w-64 rounded-lg" />
                </div>
              ))
            ) : messages?.length === 0 ? (
              <div className="text-center text-muted-foreground font-mono py-10 flex flex-col items-center justify-center">
                <Bot className="w-12 h-12 mb-4 opacity-50" />
                <p>System initialized.</p>
                <p className="text-sm mt-2 opacity-70">Ask about your biometrics, sleep patterns, or glucose trends.</p>
              </div>
            ) : (
              messages?.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-4 font-mono text-sm ${
                    msg.role === "user" 
                      ? "bg-primary/20 text-foreground border border-primary/30" 
                      : "bg-card border border-border"
                  }`}>
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase opacity-50">
                      {msg.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      <span>{msg.role}</span>
                    </div>
                    <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))
            )}
            
            {sendChat.isPending && (
              <div className="flex justify-start">
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
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={handleSend} className="flex gap-2 max-w-3xl mx-auto">
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
              className="font-mono bg-primary text-primary-foreground hover:bg-primary/80"
              data-testid="button-send-chat"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </motion.div>
    </Layout>
  );
}
