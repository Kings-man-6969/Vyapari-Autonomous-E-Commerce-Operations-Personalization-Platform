import { apiClient } from "./api-client.js";

export async function getOrCreateMyReferral() {
  return apiClient("/admin/referrals/my");
}
