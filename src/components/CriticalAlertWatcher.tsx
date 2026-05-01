// App-wide listener for new critical alerts that surfaces a toast
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function CriticalAlertWatcher() {
  const navigate = useNavigate();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ch = supabase.channel(`global-alert-watcher-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
        const a: any = payload.new;
        if (seen.current.has(a.id)) return;
        seen.current.add(a.id);
        if (a.severity === "critical") {
          toast.error(a.message, {
            description: "Critical alert raised",
            action: { label: "View", onClick: () => navigate("/app/alerts") },
            duration: 8000,
          });
        } else if (a.severity === "warning") {
          toast.warning(a.message, { duration: 5000 });
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [navigate]);

  return null;
}
