import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVehicles } from "@/hooks/useFleet";
import { Link } from "react-router-dom";

export default function Alerts() {
  const { isStaff } = useAuth();
  const { vehicles } = useVehicles();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const vMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  useEffect(() => {
    const load = async () => {
      let q = supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(200);
      if (!showResolved) q = q.eq("is_resolved", false);
      const { data } = await q;
      setAlerts(data ?? []);
    };
    load();
    const ch = supabase.channel(`alerts-page-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [showResolved]);

  const resolve = async (id: string) => {
    const { error } = await supabase.from("alerts").update({
      is_resolved: true, resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Alert resolved");
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">Realtime alert feed across the fleet.</p>
        </div>
        <Button variant="outline" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Button>
      </header>

      <div className="space-y-3">
        {alerts.length === 0 && <div className="glass rounded-xl p-8 text-center text-muted-foreground">No alerts. Fleet looks healthy. ✨</div>}
        {alerts.map((a) => {
          const v = vMap[a.vehicle_id];
          return (
            <div key={a.id} className={cn("glass flex items-center justify-between gap-4 rounded-xl p-4",
              a.severity === "critical" && "border-destructive/40",
              a.severity === "warning" && "border-warning/40")}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs uppercase",
                    a.severity === "critical" && "bg-destructive/20 text-destructive",
                    a.severity === "warning" && "bg-warning/20 text-warning",
                    a.severity === "info" && "bg-primary/20 text-primary")}>{a.severity}</span>
                  {v && <Link to={`/app/vehicles/${v.id}`} className="font-mono text-sm font-semibold hover:underline">{v.name}</Link>}
                  <span className="font-mono text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm">{a.message}</div>
              </div>
              {!a.is_resolved && isStaff && (
                <Button size="sm" variant="outline" onClick={() => resolve(a.id)}>Resolve</Button>
              )}
              {a.is_resolved && <span className="font-mono text-xs text-primary">RESOLVED</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
