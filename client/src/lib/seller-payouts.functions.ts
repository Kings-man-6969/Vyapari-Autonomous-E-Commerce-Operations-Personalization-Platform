import { apiClient } from "./api-client.js";

export async function getMyPayouts() {
  return apiClient("/seller/payouts");
}
