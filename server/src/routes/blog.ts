import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";
import { z } from "zod";

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

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// GET /api/blog/posts
router.get("/posts", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_url, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return res.json({ posts: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/blog/posts/all (Admin only)
router.get("/posts/all", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    await assertAdmin(userId);
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ posts: data ?? [] });
  } catch (err: any) {
    return res.status(err.message === "Forbidden" ? 403 : 500).json({ error: err.message });
  }
});

// GET /api/blog/post/:slug
router.get("/post/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const { data: post, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
      
    if (error) throw new Error(error.message);
    if (!post) return res.status(404).json({ error: "Post not found" });
    return res.json({ post });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/blog/save
const SaveInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(200),
  excerpt: z.string().max(400).optional(),
  body: z.string().max(50_000),
  cover_url: bucketUrl("product-images", "Cover image").optional().nullable(),
  is_published: z.boolean().default(false),
});

router.post("/save", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    await assertAdmin(userId);
    const data = SaveInput.parse(req.body);

    const payload = {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt ?? null,
      body: data.body,
      cover_url: data.cover_url ?? null,
      is_published: data.is_published,
      published_at: data.is_published ? new Date().toISOString() : null,
      author_id: userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("blog_posts")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return res.json({ ok: true, id: data.id });
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("blog_posts")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return res.json({ ok: true, id: inserted.id });
    }
  } catch (err: any) {
    const status = err.message === "Forbidden" ? 403 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// POST /api/blog/delete
router.post("/delete", requireAuth, async (req, res) => {
  try {
    const { userId } = req.context!;
    await assertAdmin(userId);
    const schema = z.object({ id: z.string().uuid() });
    const data = schema.parse(req.body);

    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return res.json({ ok: true });
  } catch (err: any) {
    const status = err.message === "Forbidden" ? 403 : 400;
    return res.status(status).json({ error: err.message });
  }
});

export default router;
