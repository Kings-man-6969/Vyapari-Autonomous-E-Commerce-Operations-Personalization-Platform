import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { z } from "zod";

const router = Router();

const PRODUCT_LIST_SELECT =
  "id, title, slug, short_description, price_cents, compare_at_cents, brand, images, rating, review_count, is_featured, stock, category_id, seller_id, categories(slug, name), sellers(store_name, store_slug)";

const PRODUCT_CARD_SELECT =
  "id, title, slug, short_description, price_cents, compare_at_cents, brand, images, rating, review_count, is_featured, stock, category_id, seller_id";

// GET /api/catalog/products
router.get("/products", optionalAuth, async (req, res) => {
  try {
    const schema = z.object({
      category: z.string().optional(),
      q: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });
    const data = schema.parse(req.query);

    let query = supabaseAdmin
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 60);

    if (data.category) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("slug", data.category)
        .maybeSingle();
      if (cat) query = query.eq("category_id", cat.id);
    }

    if (data.q && data.q.trim().length > 0) {
      const safe = data.q.trim().replace(/[,()*"'\\]/g, " ").slice(0, 100);
      if (safe.length > 0) {
        query = query.or(
          `title.ilike.%${safe}%,description.ilike.%${safe}%,brand.ilike.%${safe}%`
        );
      }
    }

    const { data: products, error } = await query;
    if (error) throw new Error(error.message);
    return res.json({ products: products ?? [] });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/catalog/featured
router.get("/featured", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("is_published", true)
      .eq("is_featured", true)
      .limit(8);
    if (error) throw new Error(error.message);
    return res.json({ products: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/categories
router.get("/categories", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id, slug, name, icon")
      .order("name");
    if (error) throw new Error(error.message);
    return res.json({ categories: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/product/:slug
router.get("/product/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("*, categories(slug, name), sellers(id, store_name, store_slug, bio, rating)")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { data: related } = await supabaseAdmin
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("is_published", true)
      .eq("category_id", product.category_id as string)
      .neq("id", product.id)
      .limit(4);

    return res.json({ product, related: related ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/store/:slug
router.get("/store/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const { data: seller, error } = await supabaseAdmin
      .from("sellers")
      .select("id, store_name, store_slug, bio, rating, logo_url, banner_url, created_at")
      .eq("store_slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!seller) return res.status(404).json({ error: "Store not found" });

    const { data: products } = await supabaseAdmin
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("is_published", true)
      .eq("seller_id", seller.id);

    return res.json({ seller, products: products ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/catalog/wishlist/toggle
router.post("/wishlist/toggle", requireAuth, async (req, res) => {
  try {
    const { supabase, userId } = req.context!;
    const schema = z.object({ productId: z.string().uuid() });
    const data = schema.parse(req.body);

    const { data: existing } = await supabase
      .from("wishlists")
      .select("id")
      .eq("product_id", data.productId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("wishlists").delete().eq("id", existing.id);
      return res.json({ wishlisted: false });
    }

    await supabase.from("wishlists").insert({ product_id: data.productId, user_id: userId });
    return res.json({ wishlisted: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/catalog/wishlist/status/:productId
router.get("/wishlist/status/:productId", requireAuth, async (req, res) => {
  try {
    const { supabase, userId } = req.context!;
    const productId = req.params.productId;

    const { data: row } = await supabase
      .from("wishlists")
      .select("id")
      .eq("product_id", productId)
      .eq("user_id", userId)
      .maybeSingle();

    return res.json({ wishlisted: !!row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
