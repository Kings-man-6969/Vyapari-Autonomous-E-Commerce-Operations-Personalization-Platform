import { apiClient } from "./api-client.js";

export async function getAdminStats() {
  return apiClient("/admin/stats");
}

export async function listAllUsers() {
  return apiClient("/admin/users");
}

export async function grantRole(data: { user_id: string; role: "customer" | "seller" | "admin" }) {
  return apiClient("/admin/users/role/grant", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function revokeRole(data: { user_id: string; role: "customer" | "seller" | "admin" }) {
  return apiClient("/admin/users/role/revoke", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listAllStores() {
  return apiClient("/admin/stores");
}

export async function deleteStore(data: { id: string }) {
  return apiClient("/admin/stores/delete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listAllProducts() {
  return apiClient("/admin/products");
}

export async function setProductPublished(data: { id: string; published: boolean }) {
  return apiClient("/admin/products/publish", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function setProductFeatured(data: { id: string; featured: boolean }) {
  return apiClient("/admin/products/feature", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listAllOrders() {
  return apiClient("/admin/orders");
}

export async function updateOrderStatus(data: { id: string; status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" }) {
  return apiClient("/admin/orders/status", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkIsAdmin() {
  return apiClient("/admin/check");
}
