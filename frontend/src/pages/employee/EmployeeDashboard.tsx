import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  Pill,
  Calendar,
  ClipboardList,
  ShoppingCart,
} from "lucide-react";

const Card = ({ title, value, icon: Icon }: any) => (
  <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
    <div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
    <Icon className="h-6 w-6 text-primary" />
  </div>
);

const EmployeeDashboard = () => {
  const { token } = useAuthStore();
  const [data, setData] = useState<any>({
    medicines: 0,
    appointments: 0,
    orders: 0,
    requests: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [appointmentsRes, ordersRes] = await Promise.all([
          fetch("http://localhost:8000/employee/appointments", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://localhost:8000/employee/orders", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const appointments = await appointmentsRes.json();
        const orders = await ordersRes.json();

        setData({
          medicines: 0, // can update later
          appointments: appointments.length,
          orders: orders.length,
          requests: 0,
        });
      } catch (err: any) {
        toast.error(err.message);
      }
    };

    if (token) fetchData();
  }, [token]);

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold mb-6">
        Employee Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Medicines" value={data.medicines} icon={Pill} />
        <Card title="Appointments" value={data.appointments} icon={Calendar} />
        <Card title="Orders" value={data.orders} icon={ShoppingCart} />
        <Card title="Requests" value={data.requests} icon={ClipboardList} />
      </div>
    </div>
  );
};

export default EmployeeDashboard;