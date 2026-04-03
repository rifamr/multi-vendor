import { useMemo } from "react";

import { useAuth } from "@/auth/AuthContext";

export default function RoleSwitcher() {
  const { user } = useAuth();
  const label = useMemo(() => {
    if (!user) return "Guest";
    if (user.role === "vendor") return "Vendor";
    if (user.role === "admin") return "Admin";
    return "Customer";
  }, [user]);

  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium">
        {label}
      </div>
    </div>
  );
}
