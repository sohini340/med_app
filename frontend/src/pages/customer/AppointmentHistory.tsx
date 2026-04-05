import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Calendar, Clock, Stethoscope, CheckCircle, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AppointmentHistory = () => {
  const { user, token } = useAuthStore();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) return;

    const fetchAppointments = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/customer/appointments`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        setAppointments(data);
      } catch (err) {
        console.error("Error fetching appointments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user, token]);

  if (loading) return <LoadingSkeleton />;

  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Format time from datetime string or separate time field
  const formatTime = (appointment: any) => {
    if (appointment.time) return appointment.time;
    if (appointment.datetime) {
      try {
        return format(parseISO(appointment.datetime), 'h:mm a');
      } catch {
        return appointment.datetime;
      }
    }
    return "N/A";
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-6">
        Appointment History
      </h1>

      {appointments.length === 0 ? (
        <EmptyState
          title="No appointments yet"
          description="Book your first appointment to see it here."
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3 text-left">Doctor</th>
                <th className="p-3 text-left">Specialization</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Visited</th>
              </tr>
            </thead>

            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-muted/30 transition">
                  <td className="p-3 text-foreground font-medium">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.doctor_name}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {a.specialization || "General"}
                  </td>
                  <td className="p-3 text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(a.date || a.datetime)}
                    </div>
                  </td>
                  <td className="p-3 text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatTime(a)}
                    </div>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="p-3">
                    {a.visited ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span className="text-xs">Visited</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="text-xs">Pending</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AppointmentHistory;