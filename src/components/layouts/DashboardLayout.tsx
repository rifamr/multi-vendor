import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Calendar, User, Star, Bell, Settings,
  Store, DollarSign, Clock, Users, ShieldCheck, Tags, FileText,
  Menu, X, ChevronLeft, LogOut
} from "lucide-react";
import RoleSwitcher from "@/components/RoleSwitcher";
import { useAuth } from "@/auth/AuthContext";

type Role = "customer" | "vendor" | "admin";

const sidebarMenus: Record<Role, { label: string; path: string; icon: React.ElementType }[]> = {
  customer: [
    { label: "Dashboard", path: "/customer/dashboard", icon: LayoutDashboard },
    { label: "Services", path: "/customer/services", icon: Store },
    { label: "My Bookings", path: "/customer/bookings", icon: Calendar },
    { label: "Profile", path: "/customer/profile", icon: User },
    { label: "Notifications", path: "/customer/notifications", icon: Bell },
  ],
  vendor: [
    { label: "Dashboard", path: "/vendor/dashboard", icon: LayoutDashboard },
    { label: "My Services", path: "/vendor/services", icon: Store },
    { label: "Bookings", path: "/vendor/bookings", icon: Calendar },
    { label: "Reviews", path: "/vendor/reviews", icon: Star },
    { label: "Earnings", path: "/vendor/earnings", icon: DollarSign },
    { label: "Profile", path: "/vendor/profile", icon: User },
    { label: "Notifications", path: "/vendor/notifications", icon: Bell },
  ],
  admin: [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Vendors", path: "/admin/vendors", icon: ShieldCheck },
    { label: "Categories", path: "/admin/categories", icon: Tags },
    { label: "Users", path: "/admin/users", icon: Users },
    { label: "Notifications", path: "/admin/notifications", icon: Bell },
  ],
};

const roleLabels: Record<Role, string> = {
  customer: "Customer",
  vendor: "Vendor",
  admin: "Admin",
};

export default function DashboardLayout({ children, role }: { children: React.ReactNode; role: Role }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const menuItems = sidebarMenus[role];

  async function handleLogout() {
    await auth.logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-xs">SB</span>
              </div>
              <span className="font-display font-bold text-sm text-sidebar-foreground">ServiceBook</span>
            </Link>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-sidebar-foreground hover:text-primary transition-colors">
            <ChevronLeft size={18} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        {!collapsed && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {roleLabels[role]} Panel
            </span>
          </div>
        )}

        <nav className="flex-1 py-4 space-y-1 px-2">
          {menuItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="space-y-2">
            <button
              onClick={() => navigate("/")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground hover:text-primary transition-colors w-full ${collapsed ? "justify-center" : ""}`}
            >
              <LogOut size={18} />
              {!collapsed && <span>Back to Home</span>}
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground hover:text-primary transition-colors w-full ${collapsed ? "justify-center" : ""}`}
            >
              <LogOut size={18} />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50 md:hidden flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-display font-bold text-xs">SB</span>
                  </div>
                  <span className="font-display font-bold text-sm text-sidebar-foreground">ServiceBook</span>
                </Link>
                <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 py-4 space-y-1 px-2">
                {menuItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-foreground" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>
            <h2 className="font-display font-semibold text-foreground">
              {menuItems.find((i) => location.pathname === i.path)?.label || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {auth.user && (
              <div className="hidden sm:block text-sm text-muted-foreground">
                Welcome{" "}
                <span className="text-foreground font-medium">
                  {auth.user.name?.trim() ? auth.user.name : auth.user.email}
                </span>
              </div>
            )}
            <RoleSwitcher />
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User size={16} className="text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
