import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { subscribeToAuthIdentity } from "@/lib/auth-subscribe";

export type AuthStatus = "loading" | "authed" | "unauthed";

/**
 * Single source of truth for client-side route protection.
 *
 * - Uses `supabase.auth.getUser()` which re-validates the JWT with the
 *   Auth server (vs `getSession()` which trusts the cached token).
 * - Subscribes to identity-changing events so sign-out in another tab
 *   immediately redirects.
 * - Redirects unauthenticated users to `/login?redirect=<current path>`
 *   so they return here after signing in.
 */
export function useRequireAuth(): { status: AuthStatus; user: User | null } {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        setStatus("unauthed");
        setUser(null);
      } else {
        setUser(data.user);
        setStatus("authed");
      }
    });

    const unsub = subscribeToAuthIdentity((session) => {
      if (!session) {
        setUser(null);
        setStatus("unauthed");
      } else {
        setUser(session.user);
        setStatus("authed");
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (status === "unauthed") {
      navigate({
        to: "/login",
        search: { redirect: location.pathname + location.search },
        replace: true,
      });
    }
  }, [status, navigate, location.pathname, location.search]);

  return { status, user };
}
