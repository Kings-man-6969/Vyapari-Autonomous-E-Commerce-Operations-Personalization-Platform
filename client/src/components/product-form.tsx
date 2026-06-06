import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, ImagePlus } from "lucide-react";

import { upsertProduct, aiSellerSuggest } from "@/lib/seller.functions";
import { generateProductImage } from "@/lib/seller-extras.functions";
import { listCategories } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Initial = {
  id?: string;
  title?: string;
  short_description?: string | null;
  description?: string;
  brand?: string | null;
  category_id?: string | null;
  price_cents?: number;
  compare_at_cents?: number | null;
  stock?: number;
  images?: unknown;
  is_published?: boolean;
};

export function ProductForm({ initial }: { initial?: Initial }) {
  const upsert = useServerFn(upsertProduct);
  const ai = useServerFn(aiSellerSuggest);
  const genImage = useServerFn(generateProductImage);
  const fetchCats = useServerFn(listCategories);
  const navigate = useNavigate();
  const { data: catData } = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });

  const [title, setTitle] = useState(initial?.title ?? "");
  const [shortDesc, setShortDesc] = useState(initial?.short_description ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [price, setPrice] = useState(initial?.price_cents ? (initial.price_cents / 100).toFixed(2) : "");
  const [compareAt, setCompareAt] = useState(
    initial?.compare_at_cents ? (initial.compare_at_cents / 100).toFixed(2) : "",
  );
  const [stock, setStock] = useState(initial?.stock?.toString() ?? "10");
  const [imagesText, setImagesText] = useState(
    Array.isArray(initial?.images) ? (initial!.images as string[]).join("\n") : "",
  );
  const [published, setPublished] = useState(initial?.is_published ?? true);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState<null | "description" | "title" | "pricing">(null);
  const [imgLoading, setImgLoading] = useState(false);

  async function runImage() {
    if (!title) return;
    setImgLoading(true);
    try {
      const { url } = await genImage({
        data: { prompt: `${title}${brand ? ` by ${brand}` : ""}${shortDesc ? ` — ${shortDesc}` : ""}` },
      });
      setImagesText((prev) => (prev ? `${prev}\n${url}` : url));
      toast.success("AI image added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image failed");
    } finally {
      setImgLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const images = imagesText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const { id } = await upsert({
        data: {
          id: initial?.id,
          title,
          short_description: shortDesc || null,
          description: desc,
          brand: brand || null,
          category_id: categoryId || null,
          price_cents: Math.round(parseFloat(price || "0") * 100),
          compare_at_cents: compareAt ? Math.round(parseFloat(compareAt) * 100) : null,
          stock: parseInt(stock || "0", 10),
          images,
          is_published: published,
        },
      });
      toast.success(initial?.id ? "Product updated" : "Product created");
      navigate({ to: "/sell/products/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function runAi(mode: "description" | "title" | "pricing") {
    setAiLoading(mode);
    try {
      const { text } = await ai({
        data: {
          mode,
          title,
          notes: shortDesc || brand || "",
          price_cents: price ? Math.round(parseFloat(price) * 100) : undefined,
        },
      });
      if (mode === "description") setDesc(text);
      else toast.success(text, { duration: 12000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiLoading(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={!title || aiLoading === "title"}
          onClick={() => runAi("title")}
        >
          {aiLoading === "title" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          AI: suggest titles
        </Button>
      </div>
      <div>
        <Label htmlFor="short">Short description</Label>
        <Input
          id="short"
          value={shortDesc ?? ""}
          onChange={(e) => setShortDesc(e.target.value)}
          maxLength={280}
          className="mt-1.5"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="desc">Description</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!title || aiLoading === "description"}
            onClick={() => runAi("description")}
          >
            {aiLoading === "description" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            AI: write description
          </Button>
        </div>
        <Textarea id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={8} className="mt-1.5" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" value={brand ?? ""} onChange={(e) => setBrand(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="cat">Category</Label>
          <select
            id="cat"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— None —</option>
            {catData?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="price">Price (USD)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1.5"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            disabled={!title || aiLoading === "pricing"}
            onClick={() => runAi("pricing")}
          >
            {aiLoading === "pricing" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            AI: suggest price
          </Button>
        </div>
        <div>
          <Label htmlFor="compare">Compare-at price (USD)</Label>
          <Input
            id="compare"
            type="number"
            step="0.01"
            min="0"
            value={compareAt}
            onChange={(e) => setCompareAt(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="images">Image URLs (one per line)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!title || imgLoading}
            onClick={runImage}
          >
            {imgLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            AI: generate image
          </Button>
        </div>
        <Textarea
          id="images"
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          rows={3}
          placeholder="https://…/image.jpg"
          className="mt-1.5 font-mono text-xs"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div>
          <Label htmlFor="pub">Published</Label>
          <p className="text-xs text-muted-foreground">Visible to shoppers when on.</p>
        </div>
        <Switch id="pub" checked={published} onCheckedChange={setPublished} />
      </div>

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Saving…" : initial?.id ? "Save changes" : "Create product"}
      </Button>
    </form>
  );
}
