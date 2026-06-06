import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to *meaningful* auth state changes only.
 *
 * Supabase fires `onAuthStateChange` on every silent token refresh
 * (~every 50 minutes, plus on tab focus). Most UI subscribers only care
 * about identity transitions (sign-in / sign-out / user-updated). Listening
 * to every event causes needless re-renders, query refetches, and cache
 * invalidations.
 *
 * This helper filters to identity-changing events and ignores
 * `TOKEN_REFRESHED` / `INITIAL_SESSION` noise.
 */
export function subscribeToAuthIdentity(
  cb: (session: Session | null, event: AuthChangeEvent) => void,
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (
      event === "SIGNED_IN" ||
      event === "SIGNED_OUT" ||
      event === "USER_UPDATED"
    ) {
      cb(session, event);
    }
  });
  return () => data.subscription.unsubscribe();
}
