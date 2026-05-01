import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({
  children,
  requireStaff = false,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireStaff?: boolean;
  requireAdmin?: boolean;
}) {
  const { session, loading, isStaff, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-mono text-sm text-muted-foreground">Initializing FleetIQ…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/app/dashboard" replace />;
  if (requireStaff && !isStaff) return <Navigate to="/app/dashboard" replace />;

  return <>{children}</>;
}
