import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { z } from "zod";
import { chatCompletion, generateImage } from "../services/ai.js";

const router = Router();

function bucketUrl(bucket: string, label: string) {
  return z
    .string()
    .url()
    .max(500)
    .refine(
      (u) => {
        const base = process.env.SUPABASE_URL ?? "";
        return (
          base.length > 0 &&
          u.startsWith(`${base}/storage/v1/object/public/${bucket}/`)
        );
      },
      { message: `${label} must be uploaded to the ${bucket} storage bucket` }
    );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function requireMyStoreId(userId: string) {
  const { data } = await supabaseAdmin
    .from("sellers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Create a store first.");
  return data.id;
}

/* ---------- Profile ---------- */

// GET /api/seller/profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle();
      
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    return res.json({
      profile,
      email: authUser?.user?.email ?? null,
      last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const ProfileInputSchema = z.object({
  full_name: z.string().min(1).max(120),
  avatar_url: bucketUrl("product-images", "Avatar").optional().nullable(),
});

// POST /api/seller/profile/update
router.post("/profile/update", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const data = ProfileInputSchema.parse(req.body);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, avatar_url: data.avatar_url ?? null })
      .eq("id", userId);
      
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Store ---------- */

// GET /api/seller/store
router.get("/store", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const { data, error } = await supabaseAdmin
      .from("sellers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return res.json({ store: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const StoreInputSchema = z.object({
  store_name: z.string().min(2).max(120),
  bio: z.string().max(2000).optional().nullable(),
  logo_url: bucketUrl("product-images", "Logo").optional().nullable(),
  banner_url: bucketUrl("product-images", "Banner").optional().nullable(),
});

// POST /api/seller/store
router.post("/store", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const data = StoreInputSchema.parse(req.body);
    
    const { data: existing } = await supabaseAdmin
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return res.status(400).json({ error: "You already have a store." });

    const base = slugify(data.store_name) || "store";
    let slug = base;
    for (let i = 0; i < 50; i++) {
      const { data: clash } = await supabaseAdmin
        .from("sellers")
        .select("id")
        .eq("store_slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${Math.floor(Math.random() * 9999)}`;
    }

    const { data: seller, error } = await supabaseAdmin
      .from("sellers")
      .insert({
        user_id: userId,
        store_name: data.store_name,
        store_slug: slug,
        bio: data.bio ?? null,
        logo_url: data.logo_url ?? null,
        banner_url: data.banner_url ?? null,
      })
      .select("*")
      .single();
      
    if (error || !seller) throw new Error(error?.message ?? "Failed to create store");

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "seller" }, { onConflict: "user_id,role" });

    return res.json({ store: seller });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/seller/store/update
router.post("/store/update", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const data = StoreInputSchema.parse(req.body);
    const { error } = await supabaseAdmin
      .from("sellers")
      .update({
        store_name: data.store_name,
        bio: data.bio ?? null,
        logo_url: data.logo_url ?? null,
        banner_url: data.banner_url ?? null,
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Products ---------- */

// GET /api/seller/products
router.get("/products", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, title, slug, price_cents, compare_at_cents, stock, brand, images, is_published, is_featured, rating, review_count, category_id, created_at")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ products: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/seller/product/:id
router.get("/product/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .eq("seller_id", sellerId)
      .maybeSingle();
      
    if (error) throw new Error(error.message);
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.json({ product });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const ProductInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  short_description: z.string().max(280).optional().nullable(),
  description: z.string().max(8000).default(""),
  brand: z.string().max(120).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  price_cents: z.number().int().min(0).max(100_000_00),
  compare_at_cents: z.number().int().min(0).max(100_000_00).optional().nullable(),
  stock: z.number().int().min(0).max(100000),
  images: z.array(bucketUrl("product-images", "Product image")).max(10).default([]),
  is_published: z.boolean().default(true),
});

// POST /api/seller/product
router.post("/product", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const data = ProductInputSchema.parse(req.body);
    const baseSlug = slugify(data.title) || "product";

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("products")
        .update({
          title: data.title,
          short_description: data.short_description ?? null,
          description: data.description,
          brand: data.brand ?? null,
          category_id: data.category_id ?? null,
          price_cents: data.price_cents,
          compare_at_cents: data.compare_at_cents ?? null,
          stock: data.stock,
          images: data.images,
          is_published: data.is_published,
        })
        .eq("id", data.id)
        .eq("seller_id", sellerId);
      if (error) throw new Error(error.message);
      return res.json({ id: data.id });
    }

    let slug = baseSlug;
    for (let i = 0; i < 50; i++) {
      const { data: clash } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${baseSlug}-${Math.floor(Math.random() * 99999)}`;
    }

    const { data: created, error } = await supabaseAdmin
      .from("products")
      .insert({
        seller_id: sellerId,
        slug,
        title: data.title,
        short_description: data.short_description ?? null,
        description: data.description,
        brand: data.brand ?? null,
        category_id: data.category_id ?? null,
        price_cents: data.price_cents,
        compare_at_cents: data.compare_at_cents ?? null,
        stock: data.stock,
        images: data.images,
        is_published: data.is_published,
      })
      .select("id")
      .single();
      
    if (error || !created) throw new Error(error?.message ?? "Failed to create product");
    return res.json({ id: created.id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/seller/product/delete
router.post("/product/delete", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const schema = z.object({ id: z.string().uuid() });
    const data = schema.parse(req.body);

    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", sellerId);
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Orders & Tracking ---------- */

// GET /api/seller/orders
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .select("id, title, quantity, unit_price_cents, image_url, order_id, product_id, orders(id, status, created_at, shipping_address)")
      .eq("seller_id", sellerId)
      .order("id", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return res.json({ items: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/seller/order/tracking
router.post("/order/tracking", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const schema = z.object({
      itemId: z.string().uuid(),
      carrier: z.string().min(1).max(60).regex(/^[A-Za-z0-9 _\-.]+$/),
      trackingNumber: z.string().min(3).max(100).regex(/^[A-Za-z0-9_\-]+$/),
    });
    const data = schema.parse(req.body);

    const { data: item, error: e1 } = await supabaseAdmin
      .from("order_items")
      .update({
        tracking_carrier: data.carrier,
        tracking_number: data.trackingNumber,
        shipped_at: new Date().toISOString(),
      })
      .eq("id", data.itemId)
      .eq("seller_id", sellerId)
      .select("order_id")
      .single();
    if (e1 || !item) throw new Error(e1?.message ?? "Failed to update tracking");

    const { data: allItems } = await supabaseAdmin
      .from("order_items")
      .select("shipped_at")
      .eq("order_id", item.order_id);
    const allShipped = (allItems ?? []).every((i) => !!i.shipped_at);
    
    if (allShipped) {
      await supabaseAdmin.from("orders").update({ status: "shipped" }).eq("id", item.order_id);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Analytics & Insights ---------- */

// GET /api/seller/analytics
router.get("/analytics", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("quantity, unit_price_cents, product_id, title, orders(created_at, status)")
      .eq("seller_id", sellerId);

    const safeItems = items ?? [];
    const revenue_cents = safeItems.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
    const units = safeItems.reduce((s, i) => s + i.quantity, 0);
    const orderIds = new Set(safeItems.map((i) => i.product_id));

    const byProduct = new Map<string, { title: string; units: number; revenue_cents: number }>();
    for (const i of safeItems) {
      const cur = byProduct.get(i.product_id) ?? { title: i.title, units: 0, revenue_cents: 0 };
      cur.units += i.quantity;
      cur.revenue_cents += i.quantity * i.unit_price_cents;
      byProduct.set(i.product_id, cur);
    }
    const top_products = Array.from(byProduct.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents)
      .slice(0, 5);

    const days: { date: string; revenue_cents: number }[] = [];
    const now = new Date();
    for (let d = 13; d >= 0; d--) {
      const day = new Date(now);
      day.setDate(now.getDate() - d);
      const key = day.toISOString().slice(0, 10);
      days.push({ date: key, revenue_cents: 0 });
    }
    for (const i of safeItems) {
      const created = (i as any).orders?.created_at;
      if (!created) continue;
      const key = new Date(created).toISOString().slice(0, 10);
      const slot = days.find((d) => d.date === key);
      if (slot) slot.revenue_cents += i.quantity * i.unit_price_cents;
    }

    const { count: productCount } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId);

    return res.json({
      revenue_cents,
      units,
      orders: orderIds.size,
      products: productCount ?? 0,
      top_products,
      daily: days,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/seller/insights
router.get("/insights", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);

    const { data: lowStock } = await supabaseAdmin
      .from("products")
      .select("id, title, slug, stock")
      .eq("seller_id", sellerId)
      .eq("is_published", true)
      .lte("stock", 5)
      .order("stock", { ascending: true })
      .limit(10);

    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("logo_url, bio")
      .eq("id", sellerId)
      .maybeSingle();

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("quantity, unit_price_cents, orders(created_at)")
      .eq("seller_id", sellerId);
      
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 3600 * 1000;
    let recentRevenue = 0;
    let recentUnits = 0;
    
    for (const i of items ?? []) {
      const created = (i as any).orders?.created_at;
      if (!created) continue;
      const t = new Date(created).getTime();
      if (t >= fourteenDaysAgo) {
        recentRevenue += i.unit_price_cents * i.quantity;
        recentUnits += i.quantity;
      }
    }
    const forecast_revenue_cents = Math.round((recentRevenue / 14) * 7);
    const forecast_units = Math.round((recentUnits / 14) * 7);

    return res.json({
      lowStock: lowStock ?? [],
      forecast: {
        next_7_days_revenue_cents: forecast_revenue_cents,
        next_7_days_units: forecast_units,
        based_on_days: 14,
      },
      onboarding: {
        hasLogo: !!seller?.logo_url,
        hasBio: !!seller?.bio,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/seller/ai-suggest
router.post("/ai-suggest", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    await requireMyStoreId(userId);
    const schema = z.object({
      mode: z.enum(["description", "title", "pricing"]),
      title: z.string().max(200).optional(),
      notes: z.string().max(2000).optional(),
      price_cents: z.number().int().min(0).max(100_000_00).optional(),
    });
    const data = schema.parse(req.body);

    const prompts: Record<typeof data.mode, string> = {
      description: `Write a compelling, conversion-focused product description for an electronics marketplace listing. Use 3 short paragraphs, mention key benefits and 2-3 specs. Avoid hype words like "revolutionary".\n\nTitle: ${data.title ?? "(none)"}\nNotes: ${data.notes ?? "(none)"}`,
      title: `Suggest 5 high-converting product titles (max 70 chars each) for an electronics listing. Return as a numbered list only, no commentary.\n\nDraft title: ${data.title ?? "(none)"}\nNotes: ${data.notes ?? "(none)"}`,
      pricing: `You are a pricing analyst for an electronics marketplace. Given the product details, suggest a price range in USD and a recommended price, with a 2-sentence justification.\n\nTitle: ${data.title ?? "(none)"}\nCurrent price: ${data.price_cents ? `$${(data.price_cents / 100).toFixed(2)}` : "(none)"}\nNotes: ${data.notes ?? "(none)"}`,
    };

    const text = await chatCompletion([
      { role: "system", content: "You are an expert e-commerce copywriter and pricing analyst. Be concise and practical." },
      { role: "user", content: prompts[data.mode] }
    ]);
    return res.json({ text });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Bulk Import ---------- */

const RowSchema = z.object({
  title: z.string().min(2).max(200),
  short_description: z.string().max(280).optional().nullable(),
  description: z.string().max(8000).optional().default(""),
  brand: z.string().max(120).optional().nullable(),
  price_cents: z.number().int().min(0).max(100_000_00),
  compare_at_cents: z.number().int().min(0).max(100_000_00).optional().nullable(),
  stock: z.number().int().min(0).max(100000).default(0),
  image_url: z.string().url().max(500).optional().nullable(),
  is_published: z.boolean().default(true),
});

// POST /api/seller/products/import
router.post("/products/import", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const schema = z.object({ rows: z.array(RowSchema).min(1).max(200) });
    const data = schema.parse(req.body);

    let created = 0;
    const errors: { row: number; message: string }[] = [];
    
    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const baseSlug = slugify(r.title) || "product";
        let slug = baseSlug;
        for (let n = 0; n < 30; n++) {
          const { data: clash } = await supabaseAdmin
            .from("products")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (!clash) break;
          slug = `${baseSlug}-${Math.floor(Math.random() * 99999)}`;
        }
        
        const { error } = await supabaseAdmin.from("products").insert({
          seller_id: sellerId,
          slug,
          title: r.title,
          short_description: r.short_description ?? null,
          description: r.description ?? "",
          brand: r.brand ?? null,
          price_cents: r.price_cents,
          compare_at_cents: r.compare_at_cents ?? null,
          stock: r.stock,
          images: r.image_url ? [r.image_url] : [],
          is_published: r.is_published,
        });
        if (error) throw new Error(error.message);
        created++;
      } catch (e: any) {
        errors.push({ row: i + 2, message: e.message || "Failed" });
      }
    }
    return res.json({ created, errors });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Coupons ---------- */

// GET /api/seller/coupons
router.get("/coupons", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ coupons: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const CouponSchema = z
  .object({
    code: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/i),
    description: z.string().max(200).optional().nullable(),
    percent_off: z.number().int().min(1).max(90).optional().nullable(),
    amount_off_cents: z.number().int().min(1).max(10_000_000).optional().nullable(),
    min_subtotal_cents: z.number().int().min(0).max(10_000_000).default(0),
    max_uses: z.number().int().min(1).max(100000).optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.percent_off || v.amount_off_cents, {
    message: "Provide either a percent or an amount discount.",
  });

// POST /api/seller/coupon
router.post("/coupon", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const data = CouponSchema.parse(req.body);
    const code = data.code.trim().toUpperCase();

    const { data: clash } = await supabaseAdmin
      .from("coupons")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (clash) return res.status(400).json({ error: "That code is already taken." });

    const { error } = await supabaseAdmin.from("coupons").insert({
      code,
      description: data.description ?? null,
      percent_off: data.percent_off ?? null,
      amount_off_cents: data.amount_off_cents ?? null,
      min_subtotal_cents: data.min_subtotal_cents,
      max_uses: data.max_uses ?? null,
      expires_at: data.expires_at ?? null,
      is_active: data.is_active,
      seller_id: sellerId,
    });
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/seller/coupon/toggle
router.post("/coupon/toggle", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const schema = z.object({ id: z.string().uuid(), is_active: z.boolean() });
    const data = schema.parse(req.body);

    const { error } = await supabaseAdmin
      .from("coupons")
      .update({ is_active: data.is_active })
      .eq("id", data.id)
      .eq("seller_id", sellerId);
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/seller/coupon/delete
router.post("/coupon/delete", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const schema = z.object({ id: z.string().uuid() });
    const data = schema.parse(req.body);

    const { error } = await supabaseAdmin
      .from("coupons")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", sellerId);
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ---------- Payouts ---------- */

// GET /api/seller/payouts
router.get("/payouts", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
      
    if (!seller) return res.json({ payouts: [], earned: 0, paid: 0, balance: 0 });

    const [{ data: items }, { data: payouts }] = await Promise.all([
      supabaseAdmin
        .from("order_items")
        .select("unit_price_cents, quantity, created_at:orders(created_at), title")
        .eq("seller_id", seller.id),
      supabaseAdmin
        .from("seller_payouts")
        .select("*")
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false }),
    ]);

    const earned = (items ?? []).reduce(
      (s, i) => s + Math.round(i.unit_price_cents * i.quantity * 0.9),
      0
    );
    const paid = (payouts ?? []).reduce(
      (s, p) => s + (p.kind === "payout" ? p.amount_cents : -p.amount_cents),
      0
    );

    return res.json({
      payouts: payouts ?? [],
      earned,
      paid,
      balance: earned - paid,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/seller/image/generate
router.post("/image/generate", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    const sellerId = await requireMyStoreId(userId);
    const schema = z.object({ prompt: z.string().min(4).max(800) });
    const data = schema.parse(req.body);

    const dataUrl = await generateImage(data.prompt);

    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
    const ext = mime.split("/")[1] ?? "png";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
    return res.json({ url: pub.publicUrl });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
