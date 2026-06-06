import { GitCompare } from "lucide-react";
import { toast } from "sonner";

import { compare, useCompare } from "@/lib/compare";
import { Button } from "@/components/ui/button";

type ItemInput = {
  productId: string;
  slug: string;
  title: string;
  brand: string | null;
  priceCents: number;
  imageUrl: string | null;
};

export function CompareButton({ item, size = "default" }: { item: ItemInput; size?: "sm" | "default" | "lg" }) {
  const items = useCompare();
  const active = items.some((i) => i.productId === item.productId);
  return (
    <Button
      size={size}
      variant={active ? "default" : "secondary"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = compare.toggle(item);
        if (r.full) toast.error("Compare is full (max 4)");
        else if (r.added) toast.success("Added to compare");
        else toast.success("Removed from compare");
      }}
    >
      <GitCompare className="mr-1.5 h-4 w-4" /> {active ? "In compare" : "Compare"}
    </Button>
  );
}
