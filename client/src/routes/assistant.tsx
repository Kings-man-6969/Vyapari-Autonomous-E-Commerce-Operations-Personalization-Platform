import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Bot, User as UserIcon } from "lucide-react";

import { chatWithAssistant } from "@/lib/assistant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Recommend a laptop under $1500 for video editing",
  "Best wireless headphones for travel?",
  "Compact phone with great camera",
  "What full-frame camera should I start with?",
];

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Shopping Assistant — Vyapari" },
      {
        name: "description",
        content: "Chat with Vyapari's AI to find the right electronics for you.",
      },
    ],
  }),
  component: AssistantPage,
});

function renderContent(text: string) {
  // Linkify /shop/<slug> references
  const parts = text.split(/(\/shop\/[a-z0-9-]+)/g);
  return parts.map((part, i) =>
    part.startsWith("/shop/") ? (
      <a key={i} href={part} className="text-primary underline-offset-2 hover:underline">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hey, I'm Vyapari — your AI shopping concierge. Tell me what you're looking for and I'll find it in the marketplace.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (history: Msg[]) => chatWithAssistant({ data: { messages: history } }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    },
    onError: (e) => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Sorry — ${(e as Error).message}` },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  function submit(text: string) {
    const t = text.trim();
    if (!t) return;
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    send.mutate(next.slice(-12));
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center gap-3 border-b border-border/60 pb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-brand)] text-primary-foreground shadow-[var(--shadow-glow)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold tracking-tight">
            Vyapari AI — Your Shopping Assistant
          </h1>
          <p className="text-xs text-muted-foreground">
            Your personal shopping concierge — answers in seconds
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Live
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-card p-4 sm:p-6"
      >
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/60 text-foreground"
                }`}
              >
                {renderContent(m.content)}
              </div>
              {m.role === "user" && (
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                  <UserIcon className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          {send.isPending && (
            <div className="flex gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <div className="rounded-2xl bg-background/60 px-4 py-2.5 text-sm text-muted-foreground">
                Thinking…
              </div>
            </div>
          )}
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="mt-3 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products, compare specs, get recommendations…"
          disabled={send.isPending}
          aria-label="Message the Vyapari AI shopping assistant"
        />
        <Button
          type="submit"
          disabled={send.isPending || !input.trim()}
          size="lg"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
