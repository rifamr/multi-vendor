import { motion } from "framer-motion";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Check, X } from "lucide-react";

type Booking = {
  id: number;
  customerId: number;
  vendorId: number;
  serviceId: number;
  slotId: number;
  status: string;
  bookingDate: string | null;
  serviceTitle: string;
  servicePrice: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  slotDate: string;
  startTime: string;
  endTime: string;
  paymentStatus?: string;
  paymentAmount?: number;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  accepted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function VendorBookings() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/bookings" : `/api/bookings?status=${filter}`;
      const response = await fetch(url, { credentials: "include" });
      const result = await response.json();

      if (result.ok) {
        setBookings(result.bookings);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch bookings.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while fetching bookings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const updateStatus = async (bookingId: number, status: string, actionLabel: string) => {
    setUpdating(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Success",
          description: `Booking ${actionLabel} successfully.`,
        });
        fetchBookings();
      } else {
        toast({
          title: "Error",
          description: result.error || `Failed to ${actionLabel.toLowerCase()} booking.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: `An error occurred while ${actionLabel.toLowerCase()}ing the booking.`,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Invalid Date";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Invalid Date";
    }
  };

  return (
    <DashboardLayout role="vendor">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          {["all", "pending", "accepted", "completed", "cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>No bookings found.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">ID</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Customer</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Service</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Date & Time</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Price</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-foreground font-mono text-xs">#{b.id}</td>
                    <td className="px-5 py-3">
                      <div className="text-foreground font-medium">{b.customerName || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {b.customerPhone || b.customerEmail}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{b.serviceTitle}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                      {b.slotDate ? `${formatDate(b.slotDate)} ${b.startTime || ''}` : 'No date set'}
                    </td>
                    <td className="px-5 py-3 text-foreground font-medium">₹{b.servicePrice}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[b.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        {b.status === "accepted" && (
                          <button
                            onClick={() => updateStatus(b.id, "completed", "Completed")}
                            disabled={updating === b.id}
                            className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                          >
                            Mark Complete
                          </button>
                        )}
                        {(b.status === "pending" || b.status === "accepted") && (
                          <button
                            onClick={() => updateStatus(b.id, "cancelled", "Cancelled")}
                            disabled={updating === b.id}
                            className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                        {(b.status === "completed" || b.status === "cancelled") && (
                          <span className="text-xs text-muted-foreground">No actions</span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
