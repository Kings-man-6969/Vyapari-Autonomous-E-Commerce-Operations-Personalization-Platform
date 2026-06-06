import { apiClient } from "./api-client.js";

export async function listPublishedPosts() {
  return apiClient("/blog/posts");
}

export async function getPostBySlug(data: { slug: string } | { data: { slug: string } }) {
  const actualData = data && "data" in data && typeof data.data === "object" ? data.data : data;
  return apiClient(`/blog/post/${actualData.slug}`);
}

export async function listAllPosts() {
  return apiClient("/blog/posts/all");
}

export async function savePost(data: {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  cover_url?: string | null;
  is_published?: boolean;
}) {
  return apiClient("/blog/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deletePost(data: { id: string }) {
  return apiClient("/blog/delete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
