/**
 * Vyapari — Client API & Authentication Utilities
 */
import Cookies from "js-cookie";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface UserSession {
  id: string;
  email: string;
  role: "customer" | "seller" | "admin";
  name?: string;
}

export const DEMO_CREDENTIALS = {
  customer: {
    email: "customer@vyapari.local",
    password: "CustomerPass123!",
    role: "customer" as const,
    name: "Aditya Sharma (Demo Shopper)",
  },
  seller: {
    email: "seller@vyapari.local",
    password: "SellerPass123!",
    role: "seller" as const,
    name: "Sharma Electronics (Demo Merchant)",
  },
  admin: {
    email: "admin@vyapari.local",
    password: "AdminPass123!",
    role: "admin" as const,
    name: "Platform Administrator",
  },
};

export function loginDemoUser(role: "customer" | "seller" | "admin"): UserSession {
  const creds = DEMO_CREDENTIALS[role];
  const demoToken = `demo_jwt_${role}_${Date.now()}`;
  setTokens(demoToken, `demo_refresh_${role}`, 86400);
  const user: UserSession = {
    id: `usr_demo_${role}`,
    email: creds.email,
    role: creds.role,
    name: creds.name,
  };
  setStoredUser(user);
  return user;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return Cookies.get("access_token") || localStorage.getItem("access_token");
}

export function setTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn = 900
): void {
  Cookies.set("access_token", accessToken, { expires: expiresIn / 86400, path: "/" });
  Cookies.set("refresh_token", refreshToken, { expires: 30, path: "/" });
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
  }
}

export function clearTokens(): void {
  Cookies.remove("access_token", { path: "/" });
  Cookies.remove("refresh_token", { path: "/" });
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("vyapari_user");
  }
}

export function getStoredUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("vyapari_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("vyapari_user", JSON.stringify(user));
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      errorDetail = response.statusText;
    }
    const error = new Error(errorDetail) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  // If status is 204 or empty response
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
