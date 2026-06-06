import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { z } from "zod";

const router = Router();

import { chatCompletion } from "../services/ai.js";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

// POST /api/assistant/chat
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const schema = z.object({ messages: z.array(MessageSchema).min(1).max(12) });
    const data = schema.parse(req.body);

    const { data: products } = await supabaseAdmin
      .from("products")
      .select("title, slug, brand, price_cents, short_description, categories(name)")
      .eq("is_published", true)
      .limit(40);

    const catalog = (products ?? [])
      .map(
        (p) =>
          `- ${p.title} (${p.brand ?? "-"}, ${(p as any).categories?.name ?? "-"}) — $${(p.price_cents / 100).toFixed(2)} — /shop/${p.slug} — ${p.short_description ?? ""}`,
      )
      .join("\n");

    const system = `You are Vyapari, an upbeat AI shopping assistant for an electronics marketplace.
Recommend products ONLY from the catalog below. When you recommend a product, include its name and the link path (e.g. /shop/aether-15-pro). If nothing in the catalog fits, say so honestly and suggest the closest option. Keep replies concise (max ~120 words) and friendly.

CATALOG:
${catalog}`;

    const reply = await chatCompletion([
      { role: "system", content: system },
      ...data.messages,
    ]);

    return res.json({ reply });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
