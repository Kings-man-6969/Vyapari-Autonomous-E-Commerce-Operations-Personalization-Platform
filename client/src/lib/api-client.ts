import { supabase } from "@/integrations/supabase/client";

/**
 * Custom fetch wrapper that automatically fetches the active Supabase JWT
 * and attaches it as an Authorization Bearer header.
 */
export async function apiClient<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  
  // Set JSON content-type if we are sending a body and it is not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.clone().text().catch(() => "");
    let jsonError: string | undefined;
    try {
      jsonError = JSON.parse(errorText).error;
    } catch (e) {}
    
    throw new Error(jsonError || errorText || `API Error: ${response.status} ${response.statusText}`);
  }
  
  // Some endpoints might return empty body on success (like resolveDispute)
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}
