import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { aiSellerSuggest } from "@/lib/seller.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/sell/assistant")({
  component: SellerAssistant,
});

function SellerAssistant() {
  const ai = useServerFn(aiSellerSuggest);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState<null | "description" | "title" | "pricing">(null);

  async function run(mode: "description" | "title" | "pricing") {
    setLoading(mode);
    setOutput("");
    try {
      const { text } = await ai({
        data: {
          mode,
          title,
          notes,
          price_cents: price ? Math.round(parseFloat(price) * 100) : undefined,
        },
      });
      setOutput(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> AI Seller Assistant
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate listings, titles, and pricing recommendations powered by Vyapari AI.
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-5">
        <div>
          <Label htmlFor="t">Product title or idea</Label>
          <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="n">Key details / specs / audience</Label>
          <Textarea id="n" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="p">Current price USD (for pricing analysis)</Label>
          <Input id="p" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("description")} disabled={!title || loading !== null} size="sm">
            {loading === "description" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Write description
          </Button>
          <Button onClick={() => run("title")} disabled={!title || loading !== null} size="sm" variant="secondary">
            {loading === "title" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Title ideas
          </Button>
          <Button onClick={() => run("pricing")} disabled={!title || loading !== null} size="sm" variant="secondary">
            {loading === "pricing" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Pricing analysis
          </Button>
        </div>
      </div>
      {output && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="mb-2 text-sm font-medium">AI output</h3>
          <pre className="whitespace-pre-wrap text-sm">{output}</pre>
        </div>
      )}
    </div>
  );
}
