// Global ⌘K command palette
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useVehicles } from "@/hooks/useFleet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, AlertTriangle, BarChart3, Brain, Cpu, FileText, Map, Rocket, Truck, Users, Wrench, Zap, BookOpen, Settings, UserCog } from "lucide-react";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { vehicles } = useVehicles();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const go = (path: string) => { navigate(path); setOpen(false); };

  const runFn = async (name: string, body?: any) => {
    setOpen(false);
    const { error } = await supabase.functions.invoke(name, body ? { body } : {});
    if (error) toast.error(error.message); else toast.success(`Ran ${name}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or vehicle name…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/app/dashboard")}><Activity className="mr-2 h-4 w-4" />Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/app/map")}><Map className="mr-2 h-4 w-4" />Live map</CommandItem>
          <CommandItem onSelect={() => go("/app/vehicles")}><Truck className="mr-2 h-4 w-4" />Vehicles</CommandItem>
          <CommandItem onSelect={() => go("/app/predictions")}><Brain className="mr-2 h-4 w-4" />Predictions</CommandItem>
          <CommandItem onSelect={() => go("/app/alerts")}><AlertTriangle className="mr-2 h-4 w-4" />Alerts</CommandItem>
          <CommandItem onSelect={() => go("/app/analytics")}><BarChart3 className="mr-2 h-4 w-4" />Analytics</CommandItem>
          <CommandItem onSelect={() => go("/app/maintenance")}><Wrench className="mr-2 h-4 w-4" />Maintenance</CommandItem>
          <CommandItem onSelect={() => go("/app/drivers")}><UserCog className="mr-2 h-4 w-4" />Drivers</CommandItem>
          <CommandItem onSelect={() => go("/app/reports")}><FileText className="mr-2 h-4 w-4" />Reports</CommandItem>
          <CommandItem onSelect={() => go("/app/admin/users")}><Users className="mr-2 h-4 w-4" />Users & roles</CommandItem>
          <CommandItem onSelect={() => go("/app/admin/rules")}><Settings className="mr-2 h-4 w-4" />Alert rules</CommandItem>
          <CommandItem onSelect={() => go("/app/admin/simulator")}><Cpu className="mr-2 h-4 w-4" />Simulator & API</CommandItem>
          <CommandItem onSelect={() => go("/app/docs/iot")}><BookOpen className="mr-2 h-4 w-4" />IoT integration</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runFn("seed-fleet", { count: 6 })}><Rocket className="mr-2 h-4 w-4" />Seed demo fleet</CommandItem>
          <CommandItem onSelect={() => runFn("simulate-telemetry", { ticks: 10 })}><Zap className="mr-2 h-4 w-4" />Push telemetry</CommandItem>
          <CommandItem onSelect={() => runFn("predict-maintenance")}><Brain className="mr-2 h-4 w-4" />Run AI predictions</CommandItem>
        </CommandGroup>
        {vehicles.length > 0 && (
          <CommandGroup heading="Vehicles">
            {vehicles.slice(0, 12).map((v) => (
              <CommandItem key={v.id} onSelect={() => go(`/app/vehicles/${v.id}`)}>
                <Truck className="mr-2 h-4 w-4" />{v.name} <span className="ml-2 font-mono text-[10px] text-muted-foreground">{v.plate}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
