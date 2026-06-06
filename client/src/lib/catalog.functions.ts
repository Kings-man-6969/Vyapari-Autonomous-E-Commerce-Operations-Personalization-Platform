import { apiClient } from "./api-client.js";

export async function listProducts(data?: { category?: string; q?: string; limit?: number } | { data: { category?: string; q?: string; limit?: number } }) {
  const actualData = data && "data" in data && typeof data.data === "object" ? data.data : data;
  const params = new URLSearchParams();
  if (actualData?.category) params.set("category", actualData.category);
  if (actualData?.q) params.set("q", actualData.q);
  if (actualData?.limit) params.set("limit", String(actualData.limit));
  
  const queryStr = params.toString();
  return apiClient(`/catalog/products${queryStr ? `?${queryStr}` : ""}`);
}

export async function listFeaturedProducts() {
  return apiClient("/catalog/featured");
}

export async function listCategories() {
  return apiClient("/catalog/categories");
}

export async function getProduct(data: { slug: string } | { data: { slug: string } }) {
  const actualData = data && "data" in data && typeof data.data === "object" ? data.data : data;
  return apiClient(`/catalog/product/${actualData.slug}`);
}

export async function getStore(data: { slug: string } | { data: { slug: string } }) {
  const actualData = data && "data" in data && typeof data.data === "object" ? data.data : data;
  return apiClient(`/catalog/store/${actualData.slug}`);
}

export async function toggleWishlist(data: { productId: string }) {
  return apiClient("/catalog/wishlist/toggle", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function isWishlisted(data: { productId: string }) {
  return apiClient(`/catalog/wishlist/status/${data.productId}`);
}
