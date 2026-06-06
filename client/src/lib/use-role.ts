import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToAuthIdentity } from "@/lib/auth-subscribe";

export type Role = "admin" | "seller" | "customer";

const RANK: Record<Role, number> = { admin: 3, seller: 2, customer: 1 };

export async function fetchPrimaryRole(userId: string): Promise<Role> {
  const [{ data: roles }, { data: seller }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("sellers").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const set = new Set<Role>((roles ?? []).map((r) => r.role as Role));
  if (seller) set.add("seller");
  if (set.size === 0) return "customer";
  return [...set].sort((a, b) => RANK[b] - RANK[a])[0];
}

export function landingForRole(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "seller") return "/sell";
  return "/shop";
}

export function useRole() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const lastUidRef = { current: undefined as string | undefined };
    async function load(uid: string | undefined) {
      if (lastUidRef.current === uid) return;
      lastUidRef.current = uid;
      if (!uid) {
        if (active) {
          setRole(null);
          setLoading(false);
        }
        return;
      }
      if (active) setLoading(true);
      const r = await fetchPrimaryRole(uid);
      if (active) {
        setRole(r);
        setLoading(false);
      }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id));
    const unsub = subscribeToAuthIdentity((s) => load(s?.user.id));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { role, loading };
}
