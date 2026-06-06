import { apiClient } from "./api-client.js";

export async function chatWithAssistant(
  data: { messages: { role: "user" | "assistant"; content: string }[] } | { data: { messages: { role: "user" | "assistant"; content: string }[] } }
) {
  const actualData = "data" in data && typeof data.data === "object" ? data.data : data;
  return apiClient("/assistant/chat", {
    method: "POST",
    body: JSON.stringify(actualData),
  });
}
