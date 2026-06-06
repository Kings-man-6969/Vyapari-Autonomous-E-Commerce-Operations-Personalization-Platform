import { apiClient } from "./api-client.js";

export async function openThread(data: { seller_id: string; product_id?: string }) {
  return apiClient("/chat/thread/open", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listMyThreads() {
  return apiClient("/chat/threads");
}

export async function getThreadMessages(data: { thread_id: string }) {
  return apiClient(`/chat/thread/${data.thread_id}`);
}

export async function sendMessage(data: { thread_id: string; body: string }) {
  return apiClient("/chat/message/send", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
