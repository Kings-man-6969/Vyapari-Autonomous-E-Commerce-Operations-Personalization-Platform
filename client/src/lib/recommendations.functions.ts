import { apiClient } from "./api-client.js";

export async function getPersonalizedRecommendations(data?: { viewedSlugs?: string[] }) {
  return apiClient("/commerce/recommendations/personalized", {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
}
