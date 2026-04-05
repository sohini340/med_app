import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  Users,
  ShoppingCart,
  Stethoscope,
  IndianRupee,
} from "lucide-react";

type DashboardData = {
  users: number;
  orders: number;
  doctors: number;
  revenue: number;
};

const StatCard = ({ title, value, icon: Icon }: any) => (
  <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
    <div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
    <Icon className="h-6 w-6 text-primary" />
  </div>
);

const AdminDashboard = () => {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("http://localhost:8000/owner/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to load dashboard");

        const json = await res.json();

        // 🔥 SAFE FALLBACK (prevents undefined crash)
        setData({
          users: json.users ?? 0,
          orders: json.orders ?? 0,
          doctors: json.doctors ?? 0,
          revenue: json.revenue ?? 0,
        });
      } catch (err: any) {
        toast.error(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDashboard();
    } else {
      setLoading(false);
      toast.error("Not authenticated");
    }
  }, [token]);

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold mb-6">
        Owner Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={data.users} icon={Users} />
        <StatCard title="Orders" value={data.orders} icon={ShoppingCart} />
        <StatCard title="Doctors" value={data.doctors} icon={Stethoscope} />
        <StatCard
          title="Revenue"
          value={`₹${data.revenue}`}
          icon={IndianRupee}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;