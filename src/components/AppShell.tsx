import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, BarChart3, FileText, LogOut, Map, Menu,
  Truck, Wrench, Users, Cpu, BookOpen, Brain, UserCog, Settings, X, Command,
  CalendarDays, Fuel, Route as RouteIcon, Webhook, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import CommandPalette from "@/components/CommandPalette";
import CriticalAlertWatcher from "@/components/CriticalAlertWatcher";
import ThemeToggle from "@/components/ThemeToggle";

interface NavItem { to: string; label: string; icon: any; staff?: boolean; admin?: boolean; }

const NAV: NavItem[] = [
  { to: "/app/dashboard", label: "Dashboard", icon: Activity },
  { to: "/app/map", label: "Live map", icon: Map },
  { to: "/app/vehicles", label: "Vehicles", icon: Truck },
  { to: "/app/me", label: "My vehicle", icon: User },
  { to: "/app/predictions", label: "Predictions", icon: Brain },
  { to: "/app/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/app/replay", label: "Trip replay", icon: RouteIcon },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3, staff: true },
  { to: "/app/scheduler", label: "Scheduler", icon: CalendarDays, staff: true },
  { to: "/app/maintenance", label: "Maintenance", icon: Wrench, staff: true },
  { to: "/app/fuel", label: "Fuel logs", icon: Fuel, staff: true },
  { to: "/app/routes", label: "Routes", icon: RouteIcon, staff: true },
  { to: "/app/drivers", label: "Drivers", icon: UserCog, staff: true },
  { to: "/app/reports", label: "Reports", icon: FileText, staff: true },
  { to: "/app/admin/users", label: "Users & roles", icon: Users, admin: true },
  { to: "/app/admin/rules", label: "Alert rules", icon: Settings, admin: true },
  { to: "/app/admin/webhooks", label: "Webhooks", icon: Webhook, admin: true },
  { to: "/app/admin/simulator", label: "Simulator & API", icon: Cpu, admin: true },
  { to: "/app/docs/iot", label: "IoT integration", icon: BookOpen },
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isAdmin, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? null));

    const refresh = () => {
      supabase.from("alerts").select("*", { count: "exact", head: true }).eq("is_resolved", false)
        .then(({ count }) => setUnread(count ?? 0));
    };
    refresh();
    const channel = supabase.channel(`alerts-badge-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const visible = NAV.filter((n) => (n.admin ? isAdmin : n.staff ? isStaff : true));
  const role = isAdmin ? "Admin" : isStaff ? "Fleet manager" : "Driver";

  return (
    <div className="flex h-full flex-col">
      <Link to="/app/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
          <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-mono text-sm font-semibold leading-tight">FleetIQ</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{role}</div>
        </div>
      </Link>

      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
        {visible.map((n) => (
          <NavLink key={n.to} to={n.to} onClick={onNavigate}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {n.to === "/app/alerts" && unread > 0 && (
              <span className="rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[10px] text-destructive-foreground">{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border pt-3">
        <div className="px-3 py-2">
          <div className="truncate text-sm">{displayName ?? user?.email}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{user?.email}</div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start"
          onClick={async () => { await signOut(); navigate("/"); }}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <CriticalAlertWatcher />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-sidebar p-4 md:block">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-border bg-background/80 px-4 py-2 backdrop-blur md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Link to="/app/dashboard" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Truck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-mono text-sm font-semibold">FleetIQ</span>
        </Link>
        <ThemeToggle />
      </div>

      <main className="flex-1 min-w-0">
        {/* Desktop top utility bar */}
        <div className="hidden items-center justify-end gap-1 border-b border-border bg-background/40 px-4 py-1.5 backdrop-blur md:flex">
          <button onClick={() => {
            const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
            document.dispatchEvent(event);
          }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-secondary">
            <Command className="h-3 w-3" /> ⌘K
          </button>
          <ThemeToggle />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
