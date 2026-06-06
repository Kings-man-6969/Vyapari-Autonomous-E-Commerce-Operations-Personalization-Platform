import { apiClient } from "./api-client.js";

export async function listMyCoupons() {
  return apiClient("/seller/coupons");
}

export async function createSellerCoupon(data: {
  code: string;
  description?: string | null;
  percent_off?: number | null;
  amount_off_cents?: number | null;
  min_subtotal_cents: number;
  max_uses?: number | null;
  expires_at?: string | null;
  is_active: boolean;
}) {
  return apiClient("/seller/coupon", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleSellerCoupon(data: { id: string; is_active: boolean }) {
  return apiClient("/seller/coupon/toggle", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteSellerCoupon(data: { id: string }) {
  return apiClient("/seller/coupon/delete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
