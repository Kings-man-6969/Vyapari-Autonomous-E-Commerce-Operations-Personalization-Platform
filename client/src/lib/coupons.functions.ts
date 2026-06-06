import { apiClient } from "./api-client.js";

export async function validateCoupon(data: { code: string; subtotalCents: number }) {
  return apiClient("/commerce/coupon/validate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
