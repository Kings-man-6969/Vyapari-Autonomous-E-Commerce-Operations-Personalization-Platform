import { apiClient } from "./api-client.js";

export async function createOrder(data: {
  items: { productId: string; quantity: number }[];
  shipping: {
    recipient: string;
    line1: string;
    line2?: string | null;
    city: string;
    region?: string | null;
    postal_code: string;
    country: string;
    phone?: string | null;
  };
  couponCode?: string;
}) {
  return apiClient("/commerce/order", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listOrders() {
  return apiClient("/commerce/orders");
}

export async function getOrder(data: { id: string }) {
  return apiClient(`/commerce/order/${data.id}`);
}

export async function listAddresses() {
  return apiClient("/commerce/addresses");
}

export async function upsertAddress(data: {
  id?: string;
  label?: string | null;
  is_default?: boolean;
  recipient: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal_code: string;
  country: string;
  phone?: string | null;
}) {
  return apiClient("/commerce/address", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAddress(data: { id: string }) {
  return apiClient("/commerce/address/delete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listReviewsForProduct(data: { productId: string }) {
  return apiClient(`/commerce/reviews/${data.productId}`);
}

export async function upsertReview(data: {
  productId: string;
  rating: number;
  title?: string;
  body?: string;
  imageUrls?: string[];
}) {
  return apiClient("/commerce/review", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listWishlist() {
  return apiClient("/commerce/wishlist");
}

export async function getRecommendations() {
  return apiClient("/commerce/recommendations");
}
