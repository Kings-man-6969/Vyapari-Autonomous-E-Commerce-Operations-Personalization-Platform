import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";

import { bulkImportProducts } from "@/lib/seller-extras.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/sell/products/import")({
  component: BulkImport,
});

const TEMPLATE = `title,short_description,brand,price,compare_at,stock,image_url,published
Wireless Headphones,Crisp ANC over-ear,Acme Audio,129.00,179.00,25,https://example.com/img.jpg,true
USB-C Hub 7-in-1,4K HDMI + PD,Voltbox,49.99,,100,,true`;

type ParsedRow = {
  title: string;
  short_description: string | null;
  brand: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  image_url: string | null;
  description: string;
  is_published: boolean;
};

function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows, errors: ["CSV must have a header row and at least one product."] };
  const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const need = ["title", "price"];
  for (const n of need) if (!header.includes(n)) errors.push(`Missing column: ${n}`);
  if (errors.length) return { rows, errors };
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((s) => s.trim());
    const get = (k: string) => cols[header.indexOf(k)] ?? "";
    const price = parseFloat(get("price") || "0");
    if (!get("title") || !price) {
      errors.push(`Row ${i + 1}: title and price are required`);
      continue;
    }
    rows.push({
      title: get("title"),
      short_description: get("short_description") || null,
      brand: get("brand") || null,
      price_cents: Math.round(price * 100),
      compare_at_cents: get("compare_at") ? Math.round(parseFloat(get("compare_at")) * 100) : null,
      stock: parseInt(get("stock") || "0", 10),
      image_url: get("image_url") || null,
      description: "",
      is_published: get("published").toLowerCase() !== "false",
    });
  }
  return { rows, errors };
}

function BulkImport() {
  const importFn = useServerFn(bulkImportProducts);
  const navigate = useNavigate();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = csv ? parseCsv(csv) : { rows: [], errors: [] };

  async function onSubmit() {
    setBusy(true);
    try {
      const r = await importFn({ data: { rows: parsed.rows } });
      if (r.errors.length > 0) {
        toast.warning(`Created ${r.created}, ${r.errors.length} failed`);
      } else {
        toast.success(`Imported ${r.created} products`);
      }
      navigate({ to: "/sell/products" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vyapari-products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Bulk import products</h2>
          <p className="text-sm text-muted-foreground">
            Paste CSV with columns: title, short_description, brand, price, compare_at, stock,
            image_url, published.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-1.5 h-4 w-4" /> Template
        </Button>
      </div>

      <Textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={14}
        placeholder={TEMPLATE}
        className="font-mono text-xs"
      />

      {csv && (
        <div className="rounded-lg border border-border/60 bg-card p-3 text-sm">
          <div>Detected <strong>{parsed.rows.length}</strong> valid rows</div>
          {parsed.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
              {parsed.errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button onClick={onSubmit} disabled={busy || parsed.rows.length === 0} size="lg">
        <Upload className="mr-1.5 h-4 w-4" /> {busy ? "Importing…" : `Import ${parsed.rows.length}`}
      </Button>
    </div>
  );
}
