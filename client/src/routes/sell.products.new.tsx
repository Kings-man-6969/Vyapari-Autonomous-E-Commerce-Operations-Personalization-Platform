import { createFileRoute } from "@tanstack/react-router";
import { ProductForm } from "@/components/product-form";

export const Route = createFileRoute("/sell/products/new")({
  component: NewProduct,
});

function NewProduct() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">New product</h2>
      <ProductForm />
    </div>
  );
}
