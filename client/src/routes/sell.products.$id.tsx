import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { getMyProduct } from "@/lib/seller.functions";
import { ProductForm } from "@/components/product-form";
import { FormSkeleton } from "@/components/loading-states";

export const Route = createFileRoute("/sell/products/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const fetchProduct = useServerFn(getMyProduct);
  const { data, isLoading } = useQuery({
    queryKey: ["my-product", id],
    queryFn: () => fetchProduct({ data: { id } }),
  });

  if (isLoading || !data) return <FormSkeleton />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Edit product</h2>
      <ProductForm initial={data.product} />
    </div>
  );
}
