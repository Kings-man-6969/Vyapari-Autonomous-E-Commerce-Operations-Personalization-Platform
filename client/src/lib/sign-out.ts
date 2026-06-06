import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralised sign-out for all roles (admin, seller, customer).
 *
 * - Signs the user out globally (revokes refresh token across devices/tabs).
 * - Clears Supabase auth keys from local/session storage as a belt-and-braces
 *   measure in case the SDK can't reach the server.
 * - Hard-navigates to `/` so every in-memory React Query cache, Zustand
 *   store, and route loader is discarded — no stale per-user data leaks
 *   into the next session on the same device.
 */
export async function signOutEverywhere(redirectTo: string = "/") {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (err) {
    console.warn("signOut failed, clearing local session anyway", err);
  }

  if (typeof window !== "undefined") {
    try {
      for (const storage of [window.localStorage, window.sessionStorage]) {
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && (k.startsWith("sb-") || k.includes("supabase"))) keys.push(k);
        }
        keys.forEach((k) => storage.removeItem(k));
      }
    } catch {
      // ignore storage errors (private mode, etc.)
    }

    toast.success("Signed out");
    // Hard reload guarantees every cache / loader is dropped.
    window.location.replace(redirectTo);
  }
}
