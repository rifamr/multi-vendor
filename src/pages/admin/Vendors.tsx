import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { toast } from "sonner";

interface Vendor {
  id: number;
  businessName: string;
  isVerified: boolean;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
}

export default function AdminVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchVendors = async () => {
    try {
      const res = await fetch("/api/admin/vendors", { credentials: "include" });
      const data = await res.json();
      if (data.ok) setVendors(data.vendors);
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const handleApprove = async (vendorId: number) => {
    setActionLoading(vendorId);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, isVerified: true } : v));
        toast.success("Vendor approved");
      } else {
        toast.error(data.error || "Failed to approve vendor");
      }
    } catch {
      toast.error("Failed to approve vendor");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (vendorId: number) => {
    setActionLoading(vendorId);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/reject`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, isVerified: false } : v));
        toast.success("Vendor rejected");
      } else {
        toast.error(data.error || "Failed to reject vendor");
      }
    } catch {
      toast.error("Failed to reject vendor");
    } finally {
      setActionLoading(null);
    }
  };

  const pending = vendors.filter(v => !v.isVerified);
  const approved = vendors.filter(v => v.isVerified);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h3 className="font-display font-semibold text-foreground">Vendor Management</h3>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No vendors registered yet.</p>
          </div>
        ) : (
          <>
            {/* Pending Vendors */}
            {pending.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Pending Approval ({pending.length})</h4>
                <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Business</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Owner</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Email</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Applied</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((v, i) => (
                        <motion.tr
                          key={v.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-5 py-3 text-foreground font-medium">{v.businessName}</td>
                          <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{v.ownerName}</td>
                          <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{v.ownerEmail}</td>
                          <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell">
                            {new Date(v.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleApprove(v.id)}
                                disabled={actionLoading === v.id}
                                className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => handleReject(v.id)}
                                disabled={actionLoading === v.id}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Approved Vendors */}
            {approved.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Approved Vendors ({approved.length})</h4>
                <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Business</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Owner</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Email</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Status</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approved.map((v, i) => (
                        <motion.tr
                          key={v.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-5 py-3 text-foreground font-medium">{v.businessName}</td>
                          <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{v.ownerName}</td>
                          <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{v.ownerEmail}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                              <ShieldCheck size={12} /> Verified
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => handleReject(v.id)}
                              disabled={actionLoading === v.id}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                              title="Revoke verification"
                            >
                              <ShieldX size={14} />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
