import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

// GET /api/alerts
router.get("/", requireAuth, async (req, res) => {
  try {
    const { supabase } = req.context!;
    const { data, error } = await supabase
      .from("product_alerts")
      .select("id, kind, threshold_cents, created_at, product_id, products(id, title, slug, price_cents, stock, images, brand)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ alerts: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/toggle
router.post("/toggle", requireAuth, async (req, res) => {
  try {
    const { supabase, userId } = req.context!;
    const schema = z.object({
      productId: z.string().uuid(),
      kind: z.enum(["price_drop", "back_in_stock"]),
      thresholdCents: z.number().int().min(0).max(10_000_000).optional(),
    });
    const data = schema.parse(req.body);

    const { data: existing } = await supabase
      .from("product_alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", data.productId)
      .eq("kind", data.kind)
      .maybeSingle();

    if (existing) {
      await supabase.from("product_alerts").delete().eq("id", existing.id);
      return res.json({ subscribed: false });
    }

    const { error } = await supabase.from("product_alerts").insert({
      user_id: userId,
      product_id: data.productId,
      kind: data.kind,
      threshold_cents: data.thresholdCents ?? null,
    });
    if (error) throw new Error(error.message);
    return res.json({ subscribed: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/alerts/product/:productId
router.get("/product/:productId", requireAuth, async (req, res) => {
  try {
    const { supabase, userId } = req.context!;
    const productId = req.params.productId;

    const { data: rows } = await supabase
      .from("product_alerts")
      .select("kind")
      .eq("user_id", userId)
      .eq("product_id", productId);

    return res.json({ kinds: (rows ?? []).map((r) => r.kind as "price_drop" | "back_in_stock") });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
