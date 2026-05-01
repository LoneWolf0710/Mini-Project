import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const map: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => { (map[r.user_id] ??= []).push(r.role); });
    setRows((profiles ?? []).map((p: any) => ({ ...p, roles: map[p.id] ?? [] })));
  };
  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, role: "admin" | "fleet_manager" | "driver") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message); else { toast.success("Role updated"); load(); }
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Users & roles</h1>
        <p className="text-muted-foreground">Promote users to fleet manager or admin.</p>
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-3 text-left">User</th>
            <th className="px-4 py-3 text-left">Current role</th>
            <th className="px-4 py-3 text-left">Set role</th>
          </tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3"><div className="font-mono">{u.display_name ?? "—"}</div><div className="font-mono text-xs text-muted-foreground">{u.id}</div></td>
                <td className="px-4 py-3 font-mono text-xs">{u.roles.join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <Select onValueChange={(v) => setRole(u.id, v as any)}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Change role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="fleet_manager">Fleet manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
