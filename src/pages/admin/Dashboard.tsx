import { motion } from "framer-motion";
import { Users, Store, Calendar, DollarSign } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import StatCard from "@/components/StatCard";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type AdminStats = {
  totalUsers: number;
  totalVendors: number;
  totalBookings: number;
  totalRevenue: number;
  usersTrend: number;
  vendorsTrend: number;
  bookingsTrend: number;
  revenueTrend: number;
};

type MonthlyGrowth = {
  month: string;
  users: number;
  vendors: number;
};

type MonthlyBookings = {
  month: string;
  bookings: number;
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [userGrowth, setUserGrowth] = useState<MonthlyGrowth[]>([]);
  const [bookingsTrend, setBookingsTrend] = useState<MonthlyBookings[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/analytics/admin", {
          credentials: "include",
        });
        const data = await response.json();

        if (data.ok) {
          setStats(data.stats);
          setUserGrowth(data.userGrowth);
          setBookingsTrend(data.bookingsTrend);
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to fetch analytics.",
            variant: "destructive",
          });
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

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats?.totalUsers.toLocaleString() || "0"}
            icon={Users}
            trend={formatTrend(stats?.usersTrend || 0)}
            trendUp={(stats?.usersTrend || 0) >= 0}
          />
          <StatCard
            label="Total Vendors"
            value={stats?.totalVendors || 0}
            icon={Store}
            trend={formatTrend(stats?.vendorsTrend || 0)}
            trendUp={(stats?.vendorsTrend || 0) >= 0}
          />
          <StatCard
            label="Total Bookings"
            value={stats?.totalBookings.toLocaleString() || "0"}
            icon={Calendar}
            trend={formatTrend(stats?.bookingsTrend || 0)}
            trendUp={(stats?.bookingsTrend || 0) >= 0}
          />
          <StatCard
            label="Revenue"
            value={`₹${((stats?.totalRevenue || 0) / 1000).toFixed(0)}K`}
            icon={DollarSign}
            trend={formatTrend(stats?.revenueTrend || 0)}
            trendUp={(stats?.revenueTrend || 0) >= 0}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-secondary border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">User Growth</h3>
            {userGrowth.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No user growth data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={userGrowth}>
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
                  <Line type="monotone" dataKey="users" stroke="hsl(25 95% 55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="vendors" stroke="hsl(200 80% 60%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl bg-secondary border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Bookings Trend</h3>
            {bookingsTrend.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No bookings data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bookingsTrend}>
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
                  <Bar dataKey="bookings" fill="hsl(25 95% 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
