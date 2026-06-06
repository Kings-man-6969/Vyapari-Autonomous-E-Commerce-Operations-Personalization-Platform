import { apiClient } from "./api-client.js";

export async function listMyAlerts() {
  return apiClient("/alerts");
}

export async function toggleAlert(data: { productId: string; kind: "price_drop" | "back_in_stock"; thresholdCents?: number }) {
  return apiClient("/alerts/toggle", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyAlertsForProduct(data: { productId: string }) {
  return apiClient(`/alerts/product/${data.productId}`);
}
