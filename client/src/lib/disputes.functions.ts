import { apiClient } from "./api-client.js";

export async function openDispute(data: { order_id: string; reason: string; details?: string }) {
  return apiClient("/admin/disputes/open", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listMyDisputes() {
  return apiClient("/admin/disputes/my");
}

export async function listAllDisputes() {
  return apiClient("/admin/disputes/all");
}

export async function resolveDispute(data: {
  id: string;
  status: "open" | "investigating" | "resolved" | "rejected";
  resolution?: string;
  refund_cents: number;
  admin_notes?: string;
}) {
  return apiClient("/admin/disputes/resolve", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
