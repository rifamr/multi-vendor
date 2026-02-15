import { motion } from "framer-motion";
import { DollarSign, Calendar, Star, TrendingUp, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import StatCard from "@/components/StatCard";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type VendorStats = {
  totalEarnings: number;
  totalBookings: number;
  avgRating: number;
  thisMonthEarnings: number;
  earningsTrend: number;
  bookingsTrend: number;
};

type MonthlyEarnings = {
  month: string;
  earnings: number;
};

type RatingDistribution = {
  stars: number;
  count: number;
  percentage: number;
};

type MostBookedService = {
  serviceId: number;
  title: string;
  bookingCount: number;
  totalRevenue: number;
};

type RecentBooking = {
  id: number;
  customerEmail: string;
  serviceTitle: string;
  slotDate: string;
  startTime: string;
  status: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  accepted: "bg-green-500/10 text-green-400 border-green-500/20",
};

export default function VendorDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarnings[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<RatingDistribution[]>([]);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [mostBookedServices, setMostBookedServices] = useState<MostBookedService[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch analytics
        const analyticsRes = await fetch("/api/analytics/vendor", {
          credentials: "include",
        });
        const analyticsData = await analyticsRes.json();

        if (analyticsData.ok) {
          setStats(analyticsData.stats);
          setMonthlyEarnings(analyticsData.monthlyEarnings);
          setRatingDistribution(analyticsData.ratingDistribution);
          if (analyticsData.mostBookedServices) {
            setMostBookedServices(analyticsData.mostBookedServices);
          }
        }

        // Fetch recent bookings
        const bookingsRes = await fetch("/api/bookings?status=pending&limit=5", {
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
      <DashboardLayout role="vendor">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="vendor">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Earnings"
            value={`₹${stats?.totalEarnings.toLocaleString() || 0}`}
            icon={DollarSign}
            trend={formatTrend(stats?.earningsTrend || 0)}
            trendUp={(stats?.earningsTrend || 0) >= 0}
          />
          <StatCard
            label="Total Bookings"
            value={stats?.totalBookings || 0}
            icon={Calendar}
            trend={formatTrend(stats?.bookingsTrend || 0)}
            trendUp={(stats?.bookingsTrend || 0) >= 0}
          />
          <StatCard label="Avg Rating" value={stats?.avgRating.toFixed(1) || "0.0"} icon={Star} />
          <StatCard
            label="This Month"
            value={`₹${stats?.thisMonthEarnings.toLocaleString() || 0}`}
            icon={TrendingUp}
            trend={formatTrend(stats?.earningsTrend || 0)}
            trendUp={(stats?.earningsTrend || 0) >= 0}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Earnings Chart */}
          <div className="rounded-2xl bg-secondary border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Earnings Overview</h3>
            {monthlyEarnings.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No earnings data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyEarnings}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(20 8% 20%)" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(20 10% 55%)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(20 10% 55%)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(20 6% 12%)",
                      border: "1px solid hsl(20 8% 20%)",
                      borderRadius: 12,
                      color: "hsl(40 20% 95%)",
                    }}
                  />
                  <Bar dataKey="earnings" fill="hsl(25 95% 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Rating Distribution */}
          <div className="rounded-2xl bg-secondary border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Rating Distribution</h3>
            <div className="space-y-3">
              {ratingDistribution.map((r) => (
                <div key={r.stars} className="flex items-center gap-3">
                  <div className="flex items-center gap-0.5 w-16">
                    {Array.from({ length: r.stars }).map((_, j) => (
                      <Star key={j} size={12} className="fill-primary text-primary" />
                    ))}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${r.percentage}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most Booked Services */}
        {mostBookedServices.length > 0 && (
          <div className="rounded-2xl bg-secondary border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" /> Most Booked Services
            </h3>
            <div className="space-y-3">
              {mostBookedServices.map((s, i) => {
                const maxCount = mostBookedServices[0]?.bookingCount || 1;
                const percentage = (s.bookingCount / maxCount) * 100;
                return (
                  <motion.div
                    key={s.serviceId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{s.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.bookingCount} booking{s.bookingCount !== 1 ? 's' : ''} · ₹{s.totalRevenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Bookings */}
        <div className="rounded-2xl bg-secondary border border-border p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">Pending Bookings</h3>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No pending bookings at the moment
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {b.customerEmail} — {b.serviceTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(b.slotDate)} at {b.startTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
