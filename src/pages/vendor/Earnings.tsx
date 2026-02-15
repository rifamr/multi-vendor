import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import StatCard from "@/components/StatCard";
import { useToast } from "@/hooks/use-toast";

type EarningsStats = {
  totalEarnings: number;
  thisMonthEarnings: number;
  earningsTrend: number;
  pendingPayout: number;
};

type MonthlyEarning = {
  month: string;
  earnings: number;
};

type Transaction = {
  id: number;
  bookingId: number;
  serviceTitle: string;
  customerName: string;
  amount: number;
  paymentStatus: string;
  paymentDate: string;
};

export default function VendorEarnings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchEarnings = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/analytics/vendor/earnings", { credentials: "include" });
        const data = await res.json();
        if (data.ok) {
          setStats(data.stats);
          setMonthlyEarnings(data.monthlyEarnings);
          setTransactions(data.transactions);
        }
      } catch {
        toast({ title: "Error", description: "Failed to load earnings data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, []);

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  };

  const trendLabel = (val: number) => (val > 0 ? `+${val.toFixed(0)}%` : val < 0 ? `${val.toFixed(0)}%` : undefined);

  return (
    <DashboardLayout role="vendor">
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total Earnings"
            value={loading ? "..." : formatCurrency(stats?.totalEarnings ?? 0)}
            icon={DollarSign}
            trend={trendLabel(stats?.earningsTrend ?? 0)}
            trendUp={(stats?.earningsTrend ?? 0) >= 0}
          />
          <StatCard
            label="This Month"
            value={loading ? "..." : formatCurrency(stats?.thisMonthEarnings ?? 0)}
            icon={TrendingUp}
            trend={trendLabel(stats?.earningsTrend ?? 0)}
            trendUp={(stats?.earningsTrend ?? 0) >= 0}
          />
          <StatCard
            label="Pending Payout"
            value={loading ? "..." : formatCurrency(stats?.pendingPayout ?? 0)}
            icon={DollarSign}
          />
        </div>

        {/* Earnings Trend Chart */}
        <div className="rounded-2xl bg-secondary border border-border p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">Earnings Trend</h3>
          {monthlyEarnings.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No earnings data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyEarnings}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(25 95% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(25 95% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(20 8% 20%)" />
                <XAxis dataKey="month" tick={{ fill: "hsl(20 10% 55%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(20 10% 55%)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(20 6% 12%)", border: "1px solid hsl(20 8% 20%)", borderRadius: 12, color: "hsl(40 20% 95%)" }}
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Earnings"]}
                />
                <Area type="monotone" dataKey="earnings" stroke="hsl(25 95% 55%)" fill="url(#earnGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Transaction History */}
        <div className="rounded-2xl bg-secondary border border-border p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">Transaction History</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => {
                const isSuccess = t.paymentStatus === "success";
                const isFailed = t.paymentStatus === "failed";
                return (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSuccess ? "bg-green-500/10" : isFailed ? "bg-red-500/10" : "bg-yellow-500/10"}`}>
                        {isSuccess ? (
                          <ArrowUpRight size={14} className="text-green-400" />
                        ) : (
                          <ArrowDownRight size={14} className={isFailed ? "text-red-400" : "text-yellow-400"} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-foreground">{t.serviceTitle}</p>
                        <p className="text-xs text-muted-foreground">{t.customerName} · {formatDate(t.paymentDate)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${isSuccess ? "text-green-400" : isFailed ? "text-red-400" : "text-yellow-400"}`}>
                        {isSuccess ? "+" : ""}₹{Math.abs(t.amount).toLocaleString("en-IN")}
                      </span>
                      <p className="text-[10px] text-muted-foreground capitalize">{t.paymentStatus}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
