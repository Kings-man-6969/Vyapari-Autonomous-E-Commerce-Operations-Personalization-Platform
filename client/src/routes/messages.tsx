import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listMyThreads, getThreadMessages, sendMessage } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Vyapari" }] }),
  component: MessagesPage,
});

type Thread = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message_at: string;
  sellers: { store_name: string; store_slug: string; user_id: string } | null;
  products: { title: string; slug: string } | null;
};

function MessagesPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const fetchThreads = useServerFn(listMyThreads);
  const fetchMessages = useServerFn(getThreadMessages);
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setUserId(data.session?.user.id ?? null);
    });
  }, []);
  useEffect(() => {
    if (authed === false) navigate({ to: "/login" });
  }, [authed, navigate]);

  const threadsQ = useQuery({
    queryKey: ["my-threads"],
    queryFn: () => fetchThreads(),
    enabled: !!authed,
  });

  const allThreads: Thread[] = [
    ...((threadsQ.data?.buyer_threads ?? []) as Thread[]),
    ...((threadsQ.data?.seller_threads ?? []) as Thread[]),
  ].sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));

  useEffect(() => {
    if (!activeId && allThreads[0]) setActiveId(allThreads[0].id);
  }, [allThreads, activeId]);

  const msgQ = useQuery({
    queryKey: ["thread", activeId],
    queryFn: () => fetchMessages({ data: { thread_id: activeId! } }),
    enabled: !!activeId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`thread-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["thread", activeId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, qc]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgQ.data?.messages.length]);

  const [body, setBody] = useState("");
  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !body.trim()) return;
    const text = body.trim();
    setBody("");
    await send({ data: { thread_id: activeId, body: text } });
    qc.invalidateQueries({ queryKey: ["thread", activeId] });
    qc.invalidateQueries({ queryKey: ["my-threads"] });
  }

  if (!authed) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Inbox"
        icon={MessageCircle}
        title="Messages"
        description="Chat directly with sellers about orders, product questions, and custom requests."
      />



      <div className="grid h-[70vh] gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card md:grid-cols-[280px_1fr]">
        <aside className="overflow-y-auto border-border/60 md:border-r">
          {allThreads.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No conversations yet. Open a product page and message a seller to start.
            </p>
          ) : (
            allThreads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "block w-full border-b border-border/40 px-4 py-3 text-left text-sm transition-colors",
                  activeId === t.id ? "bg-muted/50" : "hover:bg-muted/30",
                )}
              >
                <div className="font-medium">{t.sellers?.store_name ?? "Seller"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {t.products?.title ?? "General inquiry"}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(t.last_message_at).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </aside>

        <section className="flex min-h-0 flex-col">
          {!activeId ? (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {msgQ.data?.messages.map((m) => {
                  const mine = m.sender_id === userId;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {m.body}
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={onSend} className="flex gap-2 border-t border-border/60 p-3">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                  rows={1}
                  className="min-h-10 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend(e);
                    }
                  }}
                />
                <Button type="submit" size="icon" disabled={!body.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
