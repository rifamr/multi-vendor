import { motion } from "framer-motion";
import { Calendar, CheckCircle, Clock, DollarSign, Bell } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import StatCard from "@/components/StatCard";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type CustomerStats = {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  totalSpent: number;
  bookingsTrend: number;
  spentTrend: number;
};

type Booking = {
  id: number;
  serviceTitle: string;
  vendorName: string;
  servicePrice: number;
  slotDate: string;
  startTime: string;
  status: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  accepted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function CustomerDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch analytics
        const analyticsRes = await fetch("/api/analytics/customer", {
          credentials: "include",
        });
        const analyticsData = await analyticsRes.json();

        if (analyticsData.ok) {
          setStats(analyticsData.stats);
        }

        // Fetch recent bookings
        const bookingsRes = await fetch("/api/bookings?limit=5", {
          credentials: "include",
        });
        const bookingsData = await bookingsRes.json();

        if (bookingsData.ok) {
          setRecentBookings(bookingsData.bookings);
        }
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to fetch dashboard data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatTrend = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <DashboardLayout role="customer">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="customer">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Bookings"
            value={stats?.totalBookings || 0}
            icon={Calendar}
            trend={formatTrend(stats?.bookingsTrend || 0)}
            trendUp={(stats?.bookingsTrend || 0) >= 0}
          />
          <StatCard label="Upcoming" value={stats?.upcomingBookings || 0} icon={Clock} />
          <StatCard
            label="Completed"
            value={stats?.completedBookings || 0}
            icon={CheckCircle}
            trend={formatTrend(stats?.bookingsTrend || 0)}
            trendUp={(stats?.bookingsTrend || 0) >= 0}
          />
          <StatCard label="Total Spent" value={`₹${stats?.totalSpent.toLocaleString() || 0}`} icon={DollarSign} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Bookings */}
          <div className="lg:col-span-2 rounded-2xl bg-secondary border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Recent Bookings</h3>
            {recentBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No bookings yet. Start exploring services!
              </div>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((booking, i) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border"
                  >
                    <div>
                      <p className="font-medium text-sm text-foreground">{booking.serviceTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.vendorName} — {formatDate(booking.slotDate)} at {booking.startTime}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">₹{booking.servicePrice}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[booking.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="rounded-2xl bg-secondary border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Bell size={16} className="text-primary" /> Notifications
            </h3>
            <div className="space-y-3">
              {recentBookings.filter((b) => b.status === "accepted").length > 0 ? (
                recentBookings
                  .filter((b) => b.status === "accepted")
                  .slice(0, 4)
                  .map((b, i) => (
                    <div key={i} className="p-3 rounded-xl bg-background/50 border border-border">
                      <p className="text-sm text-foreground">
                        Your booking for {b.serviceTitle} is confirmed
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(b.slotDate)} at {b.startTime}
                      </p>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No notifications</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
