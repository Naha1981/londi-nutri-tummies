"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import { Send, Loader2, Trash2, MessageCircleHeart } from "lucide-react";

type Msg = {
  id: string;
  role: string;
  content: string;
};

const SUGGESTIONS = [
  "My toddler refuses all vegetables — help!",
  "Cheap lunchbox ideas for a 7-year-old?",
  "How do I handle snack demands all day?",
  "Is my 10-year-old eating enough protein?",
];

export function CoachView() {
  const { user, children, openUpgrade } = useAppStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/coach")
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    setPendingQuestion(message);
    // optimistic user message
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: "user", content: message }]);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => !m.id.startsWith("tmp-")));
        setInput(message);
        if (data.upgrade) openUpgrade(data.error);
        else toast({ title: "Coach unavailable", description: data.error, variant: "destructive" });
        return;
      }
      // replace with server truth (idempotent view)
      const refreshed = await fetch("/api/coach").then((r) => r.json());
      setMessages(refreshed.messages ?? []);
    } catch {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("tmp-")));
      setInput(message);
      toast({ title: "Connection problem", description: "Please try again.", variant: "destructive" });
    } finally {
      setPendingQuestion(null);
      setSending(false);
    }
  };

  const clearChat = async () => {
    setMessages([]);
    await fetch("/api/coach", { method: "DELETE" }).catch(() => {});
    toast({ title: "Fresh start 🌱", description: "Chat history cleared." });
  };

  const childNote = children.length
    ? `Coach knows about ${children.map((c) => `${c.name} (${c.ageYears})`).join(" and ")}`
    : "Add children in Settings so the coach can personalise advice";

  return (
    <div className="space-y-4 max-w-3xl mx-auto h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-2xl nt-cta-gradient grid place-items-center text-2xl shrink-0">🧑🏾‍🌾</span>
          <div>
            <h1 className="font-[family-name:var(--font-nunito)] font-black text-xl md:text-2xl leading-tight">Coach Nandi</h1>
            <p className="text-xs text-muted-foreground font-semibold">{childNote}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="rounded-full text-muted-foreground hover:text-destructive font-bold shrink-0">
            <Trash2 className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <Card className="flex-1 rounded-3xl border-border/70 flex flex-col overflow-hidden min-h-0">
        <CardContent className="flex-1 overflow-y-auto nt-scroll p-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse bg-secondary" />)}
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full grid place-items-center py-8">
              <div className="text-center max-w-sm">
                <div className="text-5xl mb-4 nt-float inline-block">💬</div>
                <h3 className="font-[family-name:var(--font-nunito)] font-black text-lg">Dumela{user ? `, ${user.name.split(" ")[0]}` : ""}! I&rsquo;m Coach Nandi.</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Fussy eaters, lunchbox fatigue, budget questions — ask me anything about feeding
                  your little ones. No judgement, just practical help.
                </p>
                <div className="mt-6 grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-left hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role !== "user" && (
                  <span className="h-8 w-8 rounded-full nt-cta-gradient grid place-items-center text-sm shrink-0 mr-2.5 mt-0.5">🧑🏾‍🌾</span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary rounded-bl-md border border-border/60"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <span className="h-8 w-8 rounded-full nt-cta-gradient grid place-items-center text-sm shrink-0 mr-2.5 mt-0.5">🧑🏾‍🌾</span>
              <div className="bg-secondary rounded-2xl rounded-bl-md border border-border/60 px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </CardContent>

        {/* Input */}
        <div className="border-t border-border/60 p-3 bg-card">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask Coach Nandi anything…"
              className="flex-1 rounded-full border border-border bg-background px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={1000}
              disabled={sending}
            />
            <Button
              onClick={() => send()}
              disabled={sending || !input.trim()}
              className="rounded-full nt-cta-gradient text-white h-11 w-11 p-0 shrink-0"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2 font-semibold">
            <MessageCircleHeart className="inline h-3 w-3 mr-0.5" />
            General guidance only — see your clinic or doctor for health concerns.
          </p>
        </div>
      </Card>

      {messages.length > 0 && messages.length < 4 && (
        <div className="flex gap-2 overflow-x-auto nt-scroll pb-1 shrink-0">
          {SUGGESTIONS.slice(0, 3).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={sending}
              className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
