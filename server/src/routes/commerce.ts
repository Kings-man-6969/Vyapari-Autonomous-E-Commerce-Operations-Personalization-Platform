import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { z } from "zod";

const router = Router();

/* ---------- Zod Schemas ---------- */

const CartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

const ShippingSchema = z.object({
  recipient: z.string().min(1).max(120),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(120),
  region: z.string().max(120).optional().nullable(),
  postal_code: z.string().min(1).max(20),
  country: z.string().min(2).max(2),
  phone: z.string().max(40).optional().nullable(),
});

const AddressInputSchema = ShippingSchema.extend({
  label: z.string().max(60).optional().nullable(),
  is_default: z.boolean().optional(),
});

/* ---------- Orders ---------- */

// POST /api/commerce/order
router.post("/order", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const schema = z.object({
      items: z.array(CartItemSchema).min(1).max(50),
      shipping: ShippingSchema,
      couponCode: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/i).optional(),
    });
    const data = schema.parse(req.body);

    const ids = data.items.map((i) => i.productId);
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("id, title, price_cents, seller_id, images, stock")
      .in("id", ids)
      .eq("is_published", true);
      
    if (error) throw new Error(error.message);
    if (!products || products.length !== ids.length) {
      return res.status(400).json({ error: "Some products are unavailable." });
    }

    let subtotal = 0;
    const lineItems = data.items.map((i) => {
      const p = products.find((pp) => pp.id === i.productId)!;
      if (p.stock < i.quantity) {
        throw new Error(`Only ${p.stock} unit(s) of "${p.title}" available`);
      }
      subtotal += p.price_cents * i.quantity;
      const images = (p.images as unknown[]) ?? [];
      return {
        product_id: p.id,
        seller_id: p.seller_id,
        title: p.title,
        unit_price_cents: p.price_cents,
        quantity: i.quantity,
        image_url: typeof images[0] === "string" ? (images[0] as string) : null,
      };
    });

    let discount_cents = 0;
    let coupon_code: string | null = null;
    if (data.couponCode) {
      const code = data.couponCode.trim().toUpperCase();
      const { data: c } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (!c) throw new Error("Invalid promo code");
      if (c.expires_at && new Date(c.expires_at) < new Date()) throw new Error("Promo code expired");
      if (c.max_uses != null && c.uses >= c.max_uses) throw new Error("Promo code limit reached");
      if (subtotal < c.min_subtotal_cents)
        throw new Error(`Spend at least $${(c.min_subtotal_cents / 100).toFixed(2)} to use this code`);
      if (c.percent_off) discount_cents = Math.round((subtotal * c.percent_off) / 100);
      else if (c.amount_off_cents) discount_cents = c.amount_off_cents;
      discount_cents = Math.min(discount_cents, subtotal);
      coupon_code = c.code;
    }

    const discounted = subtotal - discount_cents;
    const shipping_cents = discounted > 5000 ? 0 : 999;
    const tax_cents = Math.round(discounted * 0.08);
    const total_cents = discounted + shipping_cents + tax_cents;

    if (coupon_code) {
      const { data: consumed, error: consumeErr } = await supabaseAdmin.rpc(
        "consume_coupon",
        { _code: coupon_code }
      );
      if (consumeErr) throw new Error(consumeErr.message);
      if (!consumed) throw new Error("Promo code is no longer available");
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        status: "paid",
        subtotal_cents: subtotal,
        shipping_cents,
        tax_cents,
        discount_cents,
        coupon_code,
        total_cents,
        shipping_address: data.shipping,
      })
      .select("id")
      .single();
      
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Failed to create order");

    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(lineItems.map((li) => ({ ...li, order_id: order.id })));
    if (itemsErr) throw new Error(itemsErr.message);

    return res.json({ orderId: order.id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/commerce/orders
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const { supabase } = req.context!;
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, total_cents, created_at, order_items(id, title, image_url, quantity, unit_price_cents)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ orders: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/commerce/order/:id
router.get("/order/:id", requireAuth, async (req, res) => {
  try {
    const { supabase } = req.context!;
    const { id } = req.params;
    const { data: order, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .maybeSingle();
      
    if (error) throw new Error(error.message);
    if (!order) return res.status(404).json({ error: "Order not found" });
    return res.json({ order });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ---------- Addresses ---------- */

// GET /api/commerce/addresses
router.get("/addresses", requireAuth, async (req, res) => {
  try {
    const { supabase } = req.context!;
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ addresses: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/commerce/address
router.post("/address", requireAuth, async (req, res) => {
  try {
    const { supabase, userId } = req.context!;
    const schema = AddressInputSchema.extend({ id: z.string().uuid().optional() });
    const data = schema.parse(req.body);

    if (data.is_default) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    }
    
    const { id: maybeId, ...rest } = data;
    const payload = { ...rest, user_id: userId };
    
    if (maybeId) {
      const { error } = await supabase.from("addresses").update(payload).eq("id", maybeId);
      if (error) throw new Error(error.message);
      return res.json({ id: maybeId });
    }
    
    const { data: ins, error } = await supabase
      .from("addresses")
      .insert(payload)
      .select("id")
      .single();
      
    if (error || !ins) throw new Error(error?.message ?? "Failed to save address");
    return res.json({ id: ins.id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/commerce/address/delete
router.post("/address/delete", requireAuth, async (req, res) => {
  try {
    const { supabase } = req.context!;
    const schema = z.object({ id: z.string().uuid() });
    const data = schema.parse(req.body);

    const { error } = await supabase.from("addresses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Reviews ---------- */

// GET /api/commerce/reviews/:productId
router.get("/reviews/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const { data: reviews, error } = await supabaseAdmin
      .from("reviews")
      .select("id, rating, title, body, image_urls, created_at, user_id")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (error) throw new Error(error.message);

    const reviewerIds = Array.from(new Set((reviews ?? []).map((r) => r.user_id)));
    const profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    
    if (reviewerIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", reviewerIds);
      for (const p of profs ?? []) {
        profilesMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
      }
    }

    const verifiedSet = new Set<string>();
    if (reviewerIds.length > 0) {
      const { data: oi } = await supabaseAdmin
        .from("order_items")
        .select("orders!inner(user_id)")
        .eq("product_id", productId)
        .in("orders.user_id", reviewerIds);
      for (const row of oi ?? []) {
        const uid = (row as any).orders?.user_id;
        if (uid) verifiedSet.add(uid);
      }
    }

    return res.json({
      reviews: (reviews ?? []).map((r) => ({
        ...r,
        image_urls: Array.isArray(r.image_urls) ? (r.image_urls as string[]) : [],
        verified: verifiedSet.has(r.user_id),
        profiles: profilesMap.get(r.user_id) ?? { full_name: null, avatar_url: null },
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/commerce/review
router.post("/review", requireAuth, async (req, res) => {
  try {
    const { supabase, userId } = req.context!;
    const schema = z.object({
      productId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(120).optional(),
      body: z.string().max(2000).optional(),
      imageUrls: z.array(z.string().url().max(500)).max(5).optional(),
    });
    const data = schema.parse(req.body);

    const { error } = await supabase
      .from("reviews")
      .upsert(
        {
          product_id: data.productId,
          user_id: userId,
          rating: data.rating,
          title: data.title ?? null,
          body: data.body ?? null,
          image_urls: data.imageUrls ?? [],
        },
        { onConflict: "product_id,user_id" }
      );
    if (error) throw new Error(error.message);

    const { data: agg } = await supabaseAdmin
      .from("reviews")
      .select("rating")
      .eq("product_id", data.productId);
      
    if (agg && agg.length > 0) {
      const avg = agg.reduce((s, r) => s + r.rating, 0) / agg.length;
      await supabaseAdmin
        .from("products")
        .update({ rating: Number(avg.toFixed(2)), review_count: agg.length })
        .eq("id", data.productId);
    }
    
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Wishlist ---------- */

// GET /api/commerce/wishlist
router.get("/wishlist", requireAuth, async (req, res) => {
  try {
    const { supabase } = req.context!;
    const { data, error } = await supabase
      .from("wishlists")
      .select("id, created_at, products(id, title, slug, short_description, price_cents, compare_at_cents, brand, images, rating, review_count, is_featured, stock, category_id, seller_id)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ items: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ---------- Recommendations ---------- */

// GET /api/commerce/recommendations
router.get("/recommendations", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, title, slug, short_description, price_cents, compare_at_cents, brand, images, rating, review_count, is_featured, stock, category_id, seller_id")
      .eq("is_published", true)
      .order("rating", { ascending: false })
      .order("review_count", { ascending: false })
      .limit(8);
    if (error) throw new Error(error.message);
    return res.json({ products: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/commerce/recommendations/personalized
router.post("/recommendations/personalized", async (req, res) => {
  try {
    const schema = z.object({ viewedSlugs: z.array(z.string().min(1).max(200)).max(20).optional() });
    const data = schema.parse(req.body);

    const slugs = data.viewedSlugs ?? [];
    const PRODUCT_SELECT =
      "id, title, slug, short_description, price_cents, compare_at_cents, brand, images, rating, review_count, is_featured, stock, category_id, seller_id";

    if (slugs.length === 0) {
      const { data: top } = await supabaseAdmin
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("is_published", true)
        .order("rating", { ascending: false })
        .order("review_count", { ascending: false })
        .limit(8);
      return res.json({ products: top ?? [], reason: "Top picks across the marketplace" });
    }

    const { data: viewed } = await supabaseAdmin
      .from("products")
      .select("id, category_id, brand")
      .in("slug", slugs);

    const catCounts = new Map<string, number>();
    const brandCounts = new Map<string, number>();
    const seenIds = new Set<string>();

    for (const v of viewed ?? []) {
      seenIds.add(v.id);
      if (v.category_id) catCounts.set(v.category_id, (catCounts.get(v.category_id) ?? 0) + 1);
      if (v.brand) brandCounts.set(v.brand, (brandCounts.get(v.brand) ?? 0) + 1);
    }
    const topCats = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);

    let query = supabaseAdmin
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_published", true)
      .order("rating", { ascending: false })
      .limit(8);

    if (topCats.length > 0) query = query.in("category_id", topCats);
    if (seenIds.size > 0) query = query.not("id", "in", `(${Array.from(seenIds).join(",")})`);

    const { data: recs } = await query;
    const reason = topCats.length
      ? "Based on what you've been browsing"
      : "Top picks across the marketplace";
    return res.json({ products: recs ?? [], reason });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/commerce/coupon/validate
router.post("/coupon/validate", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/i),
      subtotalCents: z.number().int().min(0).max(10_000_000),
    });
    const data = schema.parse(req.body);
    const code = data.code.trim().toUpperCase();

    const { data: c, error } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!c) throw new Error("Invalid promo code");
    if (c.expires_at && new Date(c.expires_at) < new Date()) throw new Error("This code has expired");
    if (c.max_uses != null && c.uses >= c.max_uses) throw new Error("This code has reached its limit");
    if (data.subtotalCents < c.min_subtotal_cents)
      throw new Error(`Spend at least $${(c.min_subtotal_cents / 100).toFixed(2)} to use this code`);

    let discount = 0;
    if (c.percent_off) discount = Math.round((data.subtotalCents * c.percent_off) / 100);
    else if (c.amount_off_cents) discount = c.amount_off_cents;
    discount = Math.min(discount, data.subtotalCents);

    return res.json({
      code: c.code,
      description: c.description,
      percent_off: c.percent_off,
      amount_off_cents: c.amount_off_cents,
      discount_cents: discount,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
