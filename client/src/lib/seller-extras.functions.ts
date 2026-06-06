import { apiClient } from "./api-client.js";

export async function bulkImportProducts(data: {
  rows: {
    title: string;
    short_description?: string | null;
    description?: string;
    brand?: string | null;
    price_cents: number;
    compare_at_cents?: number | null;
    stock: number;
    image_url?: string | null;
    is_published: boolean;
  }[];
}) {
  return apiClient("/seller/products/import", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSellerInsights() {
  return apiClient("/seller/insights");
}

export async function updateOrderItemTracking(data: { itemId: string; carrier: string; trackingNumber: string }) {
  return apiClient("/seller/order/tracking", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function generateProductImage(data: { prompt: string }) {
  return apiClient("/seller/image/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
