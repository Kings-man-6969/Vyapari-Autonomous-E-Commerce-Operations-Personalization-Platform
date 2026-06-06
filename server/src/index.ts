import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabaseAdmin } from "./supabase.js";
import alertsRouter from "./routes/alerts.js";
import assistantRouter from "./routes/assistant.js";
import catalogRouter from "./routes/catalog.js";
import commerceRouter from "./routes/commerce.js";
import chatRouter from "./routes/chat.js";
import blogRouter from "./routes/blog.js";
import sellerRouter from "./routes/seller.js";
import adminRouter from "./routes/admin.js";

dotenv.config({ path: "../.env" });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigin = process.env.CLIENT_URL || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

// Register API Routes
app.use("/api/alerts", alertsRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/commerce", commerceRouter);
app.use("/api/chat", chatRouter);
app.use("/api/blog", blogRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/admin", adminRouter);

// Dynamic Robots.txt
app.get("/robots.txt", (req, res) => {
  const origin = process.env.SITE_URL || "https://vyapari.shop";
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /sell",
    "Disallow: /checkout",
    "Disallow: /cart",
    "Disallow: /messages",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  res.type("text/plain").send(body);
});

// Dynamic LLMs.txt
app.get("/llms.txt", (req, res) => {
  const body = `# Vyapari

> AI-native commerce platform where independent sellers run smarter electronics storefronts and buyers shop with an AI assistant.

Vyapari blends a curated electronics marketplace with an AI shopping assistant for buyers and an intelligence layer for sellers. The site covers product discovery, store pages, an AI assistant, and editorial content.

## Pages

- [Home](https://vyapari.shop/): Overview of the Vyapari AI commerce platform.
- [Shop](https://vyapari.shop/shop): Browse electronics from independent sellers.
- [Assistant](https://vyapari.shop/assistant): Chat with Vyapari AI for shopping recommendations.
- [Compare](https://vyapari.shop/compare): Side-by-side comparison of saved products.
- [Blog](https://vyapari.shop/blog): Stories, guides, and updates from the Vyapari team.
`;
  res.type("text/plain").send(body);
});

// Dynamic Sitemap.xml
app.get("/sitemap.xml", async (req, res) => {
  try {
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
        }</url>`
      );
    }
    for (const s of stores ?? []) {
      urls.push(
        `<url><loc>${origin}/store/${s.store_slug}</loc>${
          s.created_at ? `<lastmod>${new Date(s.created_at).toISOString()}</lastmod>` : ""
        }</url>`
      );
    }
    for (const p of posts ?? []) {
      urls.push(
        `<url><loc>${origin}/blog/${p.slug}</loc>${
          p.published_at ? `<lastmod>${new Date(p.published_at).toISOString()}</lastmod>` : ""
        }</url>`
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
    res.type("application/xml").send(xml);
  } catch (err: any) {
    res.status(500).send("Error generating sitemap");
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Express running at http://localhost:${PORT}`);
});
