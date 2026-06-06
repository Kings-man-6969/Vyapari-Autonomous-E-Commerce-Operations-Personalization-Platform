import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = process.env.SITE_URL || "https://vyapari.shop";
        const staticPaths = ["/", "/shop", "/blog", "/assistant", "/compare", "/login", "/signup"];

        const [{ data: products }, { data: stores }, { data: posts }] = await Promise.all([
          supabaseAdmin
            .from("products")
            .select("slug, created_at")
            .eq("is_published", true)
            .limit(5000),
          supabaseAdmin
            .from("sellers")
            .select("store_slug, created_at")
            .limit(1000),
          supabaseAdmin
            .from("blog_posts")
            .select("slug, published_at")
            .eq("is_published", true)
            .limit(2000),
        ]);

        const urls: string[] = [];
        for (const p of staticPaths) {
          urls.push(`<url><loc>${origin}${p}</loc></url>`);
        }
        for (const p of products ?? []) {
          urls.push(
            `<url><loc>${origin}/shop/${p.slug}</loc>${
              p.created_at ? `<lastmod>${new Date(p.created_at).toISOString()}</lastmod>` : ""
            }</url>`,
          );
        }
        for (const s of stores ?? []) {
          urls.push(
            `<url><loc>${origin}/store/${s.store_slug}</loc>${
              s.created_at ? `<lastmod>${new Date(s.created_at).toISOString()}</lastmod>` : ""
            }</url>`,
          );
        }
        for (const p of posts ?? []) {
          urls.push(
            `<url><loc>${origin}/blog/${p.slug}</loc>${
              p.published_at ? `<lastmod>${new Date(p.published_at).toISOString()}</lastmod>` : ""
            }</url>`,
          );
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
