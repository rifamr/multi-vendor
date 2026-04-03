import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/AuthContext";
import type { AuthRole } from "@/lib/auth";
import { roleToDashboardPath } from "@/lib/auth";

export default function RequireAuth({ allowedRoles }: { allowedRoles: AuthRole[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleToDashboardPath(user.role)} replace />;
  }

  return <Outlet />;
}
