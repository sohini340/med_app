import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import {
  BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import {
  DollarSign, Pill, Clock, Calendar,
  Star, Users, Stethoscope, RefreshCw, TrendingUp, Package, Smile, Activity
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const API = "http://localhost:8000/owner/overview";
const COLORS = ["#2A9D8F", "#457B9D", "#E9C46A", "#E76F51", "#264653", "#F4A261"];

type Stats = {
  totalSales?: number;
  totalMedicines?: number;
  pendingRequests?: number;
  appointmentsToday?: number;
  avgRating?: number;
  empRequests?: number;
  visitedToday?: number;
};

type Charts = {
  salesTime?: any[];
  demand?: any[];
  inventory?: any[];
  mood?: any[];
  category?: any[];
  doctorVisits?: any[];
};

const Overview = () => {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<Stats>({});
  const [charts, setCharts] = useState<Charts>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (showRefreshToast = false) => {
    if (!token) {
      setLoading(false);
      toast.error("Not authenticated");
      return;
    }

    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to load overview");
      }

      const data = await res.json();
      
      setStats({
        totalSales: data?.stats?.totalSales ?? 0,
        totalMedicines: data?.stats?.totalMedicines ?? 0,
        pendingRequests: data?.stats?.pendingRequests ?? 0,
        appointmentsToday: data?.stats?.appointmentsToday ?? 0,
        avgRating: data?.stats?.avgRating ?? 0,
        empRequests: data?.stats?.empRequests ?? 0,
        visitedToday: data?.stats?.visitedToday ?? 0,
      });
      
      setCharts({
        salesTime: data?.charts?.salesTime ?? [],
        demand: data?.charts?.demand ?? [],
        inventory: data?.charts?.inventory ?? [],
        mood: data?.charts?.mood ?? [],
        category: data?.charts?.category ?? [],
        doctorVisits: data?.charts?.doctorVisits ?? [],
      });
      
      if (showRefreshToast) {
        toast.success("Data refreshed successfully");
      }
    } catch (err: any) {
      console.error("Overview load error:", err);
      toast.error(err.message || "Error loading overview");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  if (loading) return <CardSkeleton count={6} />;

  const statCards = [
    { label: "Sales Today", value: `₹${stats.totalSales?.toLocaleString() ?? 0}`, icon: DollarSign },
    { label: "Total Medicines", value: stats.totalMedicines?.toLocaleString() ?? 0, icon: Pill },
    { label: "Pending Requests", value: stats.pendingRequests ?? 0, icon: Clock },
    { label: "Appointments Today", value: stats.appointmentsToday ?? 0, icon: Calendar },
    { label: "Avg Rating", value: `${stats.avgRating ?? 0} ⭐`, icon: Star },
    { label: "Employee Requests", value: stats.empRequests ?? 0, icon: Users },
    { label: "Visits Today", value: stats.visitedToday ?? 0, icon: Stethoscope },
  ];

  const hasSalesData = charts.salesTime && charts.salesTime.length > 0;
  const hasDemandData = charts.demand && charts.demand.length > 0;
  const hasInventoryData = charts.inventory && charts.inventory.length > 0;
  const hasMoodData = charts.mood && charts.mood.length > 0;
  const hasCategoryData = charts.category && charts.category.length > 0;
  const hasDoctorVisitsData = charts.doctorVisits && charts.doctorVisits.length > 0;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Dashboard analytics and insights</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-1.5 h-8 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-3 hover:border-primary/50 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-muted/50">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* SALES TREND */}
        <ChartCard title="Sales Trend" subtitle="Last 7 days">
          {hasSalesData ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={charts.salesTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(value: any) => [`₹${value}`, 'Sales']}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#2A9D8F" 
                  strokeWidth={2}
                  dot={{ fill: '#2A9D8F', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="No sales data available" icon={<TrendingUp className="h-8 w-8" />} />
          )}
        </ChartCard>

        {/* TOP MEDICINE DEMAND */}
        <ChartCard title="Top Medicine Demand" subtitle="Most requested medicines">
          {hasDemandData ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.demand} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="qty" fill="#457B9D" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="No demand data available" icon={<Package className="h-8 w-8" />} />
          )}
        </ChartCard>

        {/* INVENTORY STATUS */}
        <ChartCard title="Inventory Status" subtitle="Stock distribution">
          {hasInventoryData ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={charts.inventory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {charts.inventory.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="No inventory data available" icon={<Package className="h-8 w-8" />} />
          )}
        </ChartCard>

        {/* FEEDBACK MOOD */}
        <ChartCard title="Feedback Mood" subtitle="Customer sentiment analysis">
          {hasMoodData ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.mood}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="#E9C46A" radius={[4, 4, 0, 0]}>
                  {charts.mood.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="No mood data available" icon={<Smile className="h-8 w-8" />} />
          )}
        </ChartCard>

        {/* FEEDBACK CATEGORIES */}
        <ChartCard title="Feedback Categories" subtitle="By topic">
          {hasCategoryData ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={charts.category}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {charts.category.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="No category data available" icon={<Activity className="h-8 w-8" />} />
          )}
        </ChartCard>

        {/* DOCTOR VISITS */}
        <ChartCard title="Doctor Visits" subtitle="Visit statistics">
          {hasDoctorVisitsData ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts.doctorVisits}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={10} angle={-25} textAnchor="end" height={60} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="visited" fill="#2A9D8F" name="Visited" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notVisited" fill="#E76F51" name="Not Visited" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState message="No doctor visits data available" icon={<Activity className="h-8 w-8" />} />
          )}
        </ChartCard>

      </div>
    </div>
  );
};

// Chart wrapper component
const ChartCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl border border-border overflow-hidden">
    <div className="px-4 py-3 border-b border-border">
      <h2 className="font-semibold text-sm text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

// Chart empty state component
const ChartEmptyState = ({ message, icon }: { message: string; icon: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center h-[250px] text-center">
    <div className="text-muted-foreground/30 mb-2">
      {icon}
    </div>
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

export default Overview;