export type AuthRole = "customer" | "vendor" | "admin";

export type AuthUser = {
  id: number;
  email: string;
  role: AuthRole;
  name: string | null;
  phone?: string | null;
  provider: "local" | "google";
};

const KEYS = {
  selectedRole: "auth.selectedRole",
} as const;

export function getSelectedRole(): AuthRole | null {
  const value = localStorage.getItem(KEYS.selectedRole);
  if (value === "customer" || value === "vendor" || value === "admin") return value;
  return null;
}

export function setSelectedRole(role: AuthRole): void {
  localStorage.setItem(KEYS.selectedRole, role);
}

export function roleToDashboardPath(role: AuthRole): string {
  if (role === "admin") return "/admin/dashboard";
  return role === "vendor" ? "/vendor/dashboard" : "/customer/services";
}
