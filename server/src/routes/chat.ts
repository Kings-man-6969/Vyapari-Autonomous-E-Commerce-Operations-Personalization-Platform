import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { z } from "zod";

const router = Router();

const OpenThreadInput = z.object({
  seller_id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
});

const SendInput = z.object({
  thread_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
});

type ThreadRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message_at: string;
  created_at: string;
  sellers: { store_name: string; store_slug: string; user_id: string } | null;
  products: { title: string; slug: string } | null;
};

// POST /api/chat/thread/open
router.post("/thread/open", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const data = OpenThreadInput.parse(req.body);

    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("id, user_id")
      .eq("id", data.seller_id)
      .maybeSingle();
      
    if (!seller) return res.status(404).json({ error: "Seller not found" });
    if (seller.user_id === userId) return res.status(400).json({ error: "Cannot message yourself" });

    let q = supabaseAdmin
      .from("chat_threads")
      .select("id")
      .eq("buyer_id", userId)
      .eq("seller_id", data.seller_id);
      
    q = data.product_id ? q.eq("product_id", data.product_id) : q.is("product_id", null);
    
    const { data: existing } = await q.maybeSingle();
    if (existing) return res.json({ thread_id: existing.id });

    const { data: inserted, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({
        buyer_id: userId,
        seller_id: data.seller_id,
        product_id: data.product_id ?? null,
      })
      .select("id")
      .single();
      
    if (error) throw new Error(error.message);
    return res.json({ thread_id: inserted.id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/chat/threads
router.get("/threads", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const { data: sellerRow } = await supabaseAdmin
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: buyerThreadsRaw } = await supabaseAdmin
      .from("chat_threads")
      .select("*, sellers(store_name, store_slug, user_id), products(title, slug)")
      .eq("buyer_id", userId)
      .order("last_message_at", { ascending: false });

    const { data: sellerThreadsRaw } = sellerRow
      ? await supabaseAdmin
          .from("chat_threads")
          .select("*, sellers(store_name, store_slug, user_id), products(title, slug)")
          .eq("seller_id", sellerRow.id)
          .order("last_message_at", { ascending: false })
      : { data: [] };

    return res.json({
      buyer_threads: (buyerThreadsRaw ?? []) as unknown as ThreadRow[],
      seller_threads: (sellerThreadsRaw ?? []) as unknown as ThreadRow[],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/thread/:thread_id
router.get("/thread/:thread_id", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const threadId = req.params.thread_id;

    const { data: threadRaw } = await supabaseAdmin
      .from("chat_threads")
      .select("*, sellers(store_name, store_slug, user_id), products(title, slug)")
      .eq("id", threadId)
      .maybeSingle();
      
    if (!threadRaw) return res.status(404).json({ error: "Thread not found" });
    const thread = threadRaw as unknown as ThreadRow;
    const isBuyer = thread.buyer_id === userId;
    const isSeller = thread.sellers?.user_id === userId;
    if (!isBuyer && !isSeller) return res.status(430).json({ error: "Forbidden" });

    const { data: messages, error } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
      
    if (error) throw new Error(error.message);
    return res.json({ thread, messages: messages ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/message/send
router.post("/message/send", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const data = SendInput.parse(req.body);

    const { data: threadRaw } = await supabaseAdmin
      .from("chat_threads")
      .select("buyer_id, seller_id, sellers(user_id)")
      .eq("id", data.thread_id)
      .maybeSingle();
      
    if (!threadRaw) return res.status(404).json({ error: "Thread not found" });
    const t = threadRaw as unknown as {
      buyer_id: string;
      sellers: { user_id: string } | null;
    };
    if (t.buyer_id !== userId && t.sellers?.user_id !== userId) {
      return res.status(430).json({ error: "Forbidden" });
    }

    const { error } = await supabaseAdmin.from("chat_messages").insert({
      thread_id: data.thread_id,
      sender_id: userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    
    await supabaseAdmin
      .from("chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.thread_id);
      
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
