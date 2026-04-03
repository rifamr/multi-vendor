import { Users, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { toast } from "sonner";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  joined: string;
  createdAt: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  vendor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  customer: "bg-green-500/10 text-green-400 border-green-500/20",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/admin/users", { credentials: "include" });
        const data = await res.json();
        if (data.ok) {
          setUsers(data.users);
        } else {
          toast.error(data.error || "Failed to load users");
        }
      } catch (err) {
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-foreground">User Management</h3>
          <span className="text-sm text-muted-foreground">{users.length} users</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p>No users found.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Email</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-foreground font-medium">{u.name}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${roleColors[u.role.toLowerCase()] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{u.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
