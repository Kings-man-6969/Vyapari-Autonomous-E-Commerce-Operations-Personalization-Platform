import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";

import { listAllUsers, grantRole, revokeRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type Role = "customer" | "seller" | "admin";
const ALL_ROLES: Role[] = ["customer", "seller", "admin"];

function AdminUsers() {
  const fetchUsers = useServerFn(listAllUsers);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  async function toggleRole(user_id: string, role: Role, has: boolean) {
    try {
      if (has) await revoke({ data: { user_id, role } });
      else await grant({ data: { user_id, role } });
      toast.success(`${has ? "Revoked" : "Granted"} ${role}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (isLoading || !data) return <TableSkeleton />;

  return (
    <div>
      <SectionHeader
        eyebrow="People"
        icon={Users}
        title="Users & roles"
        description="Grant seller or admin access. Roles take effect on the user's next request."
      />
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">

          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Roles</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.id} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-3">
                <div className="font-medium">{u.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {u.roles.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                  {u.roles.map((r) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                      {r}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap justify-end gap-1.5">
                  {ALL_ROLES.map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <Button
                        key={r}
                        size="sm"
                        variant={has ? "secondary" : "outline"}
                        onClick={() => toggleRole(u.id, r, has)}
                      >
                        {has ? `− ${r}` : `+ ${r}`}
                      </Button>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

