import { apiClient } from "./api-client.js";

export async function getPlatformAnalytics() {
  return apiClient("/admin/analytics");
}

export async function getFraudSignals() {
  return apiClient("/admin/fraud");
}

export async function listAllPayouts() {
  return apiClient("/admin/payouts/all");
}

export async function computePayoutBalances() {
  return apiClient("/admin/payouts/balances");
}

export async function recordPayout(data: {
  seller_id: string;
  amount_cents: number;
  reference?: string;
  notes?: string;
}) {
  return apiClient("/admin/payouts/record", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getModerationQueue() {
  return apiClient("/admin/moderation");
}

export async function scanContentWithAI() {
  return apiClient("/admin/moderation/scan", {
    method: "POST",
  });
}

export async function resolveModerationItem(data: { id: string; action: "approve" | "remove" }) {
  return apiClient("/admin/moderation/resolve", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
