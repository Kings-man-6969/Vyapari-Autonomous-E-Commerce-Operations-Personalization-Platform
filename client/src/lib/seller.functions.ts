import { apiClient } from "./api-client.js";

export async function getMyProfile() {
  return apiClient("/seller/profile");
}

export async function updateMyProfile(data: { full_name: string; avatar_url?: string | null }) {
  return apiClient("/seller/profile/update", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyStore() {
  return apiClient("/seller/store");
}

export async function createStore(data: {
  store_name: string;
  bio?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
}) {
  return apiClient("/seller/store", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStore(data: {
  store_name: string;
  bio?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
}) {
  return apiClient("/seller/store/update", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listMyProducts() {
  return apiClient("/seller/products");
}

export async function getMyProduct(data: { id: string }) {
  return apiClient(`/seller/product/${data.id}`);
}

export async function upsertProduct(data: {
  id?: string;
  title: string;
  short_description?: string | null;
  description: string;
  brand?: string | null;
  category_id?: string | null;
  price_cents: number;
  compare_at_cents?: number | null;
  stock: number;
  images: string[];
  is_published: boolean;
}) {
  return apiClient("/seller/product", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(data: { id: string }) {
  return apiClient("/seller/product/delete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listSellerOrders() {
  return apiClient("/seller/orders");
}

export async function getSellerAnalytics() {
  return apiClient("/seller/analytics");
}

export async function aiSellerSuggest(data: {
  mode: "description" | "title" | "pricing";
  title?: string;
  notes?: string;
  price_cents?: number;
}) {
  return apiClient("/seller/ai-suggest", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
