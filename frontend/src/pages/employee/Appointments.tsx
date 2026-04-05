import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Search, X, Filter, ChevronDown } from "lucide-react";

const API = "http://localhost:8000/employee/appointments";

type Appointment = {
  appointment_id: number;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  appointment_date: string;
  appointment_time: string;
  visited: boolean;
};

type DateFilter = "all" | "today" | "7days" | "15days" | "30days";

const EmployeeAppointments = () => {
  const { token } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const safe = Array.isArray(data)
        ? data.map((a) => ({
            ...a,
            appointment_date: a.appointment_date || "",
            appointment_time: a.appointment_time || "",
            visited: Boolean(a.visited),
          }))
        : [];
      setAppointments(safe);
      setFilteredAppointments(safe);
    } catch {
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    else { setLoading(false); toast.error("Not authenticated"); }
  }, [token]);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...appointments];

    // Apply search filter
    if (search.trim()) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.patient_name.toLowerCase().includes(searchTerm) ||
          a.patient_phone.includes(searchTerm) ||
          a.doctor_name.toLowerCase().includes(searchTerm)
      );
    }

    // Apply date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const getDateFromStr = (dateStr: string) => {
      if (!dateStr) return null;
      const [year, month, day] = dateStr.split("-");
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    filtered = filtered.filter((a) => {
      if (!a.appointment_date) return dateFilter === "all";
      
      const appointmentDate = getDateFromStr(a.appointment_date);
      if (!appointmentDate) return dateFilter === "all";
      
      const diffTime = appointmentDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case "today":
          return diffDays === 0;
        case "7days":
          return diffDays >= 0 && diffDays <= 7;
        case "15days":
          return diffDays >= 0 && diffDays <= 15;
        case "30days":
          return diffDays >= 0 && diffDays <= 30;
        default:
          return true;
      }
    });

    setFilteredAppointments(filtered);
  }, [search, dateFilter, appointments]);

  const toggleVisited = async (id: number, current: boolean) => {
    setAppointments((prev) =>
      prev.map((a) => a.appointment_id === id ? { ...a, visited: !current } : a)
    );
    try {
      const res = await fetch(`${API}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ visited: !current }),
      });
      if (!res.ok) throw new Error();
      toast.success("Appointment updated");
    } catch {
      toast.error("Failed to update");
      setAppointments((prev) =>
        prev.map((a) => a.appointment_id === id ? { ...a, visited: current } : a)
      );
    }
  };

  const clearSearch = () => setSearch("");

  const formatDate = (date: string) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatTime = (time: string) => {
    if (!time) return "—";
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
  };

  const isToday = (date: string) => {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case "today": return "Today";
      case "7days": return "Next 7 Days";
      case "15days": return "Next 15 Days";
      case "30days": return "Next 30 Days";
      default: return "All Appointments";
    }
  };

  const totalVisited = appointments.filter((a) => a.visited).length;
  const filteredCount = filteredAppointments.length;
  const filteredVisited = filteredAppointments.filter((a) => a.visited).length;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage patient visits</p>
        </div>
        {appointments.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
            <Calendar className="h-3 w-3" />
            {totalVisited}/{appointments.length} visited
          </div>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient name, phone, or doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/60"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 h-9 text-xs"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {dateFilter !== "all" && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="bg-muted/30 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">Date Range:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All" },
                { value: "today", label: "Today" },
                { value: "7days", label: "Next 7 Days" },
                { value: "15days", label: "Next 15 Days" },
                { value: "30days", label: "Next 30 Days" },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setDateFilter(filter.value as DateFilter)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    dateFilter === filter.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted border border-border"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active filter indicator */}
        {dateFilter !== "all" && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing: <span className="font-medium text-foreground">{getFilterLabel()}</span>
            </p>
            <button
              onClick={() => setDateFilter("all")}
              className="text-xs text-primary hover:underline"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      {filteredAppointments.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {filteredCount} appointment{filteredCount !== 1 ? "s" : ""}
            {filteredCount > 0 && ` · ${filteredVisited} visited`}
          </p>
        </div>
      )}

      {/* Appointments Table */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-card rounded-xl border border-border py-14 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">
            {search || dateFilter !== "all" ? "No matching appointments" : "No appointments"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || dateFilter !== "all" 
              ? "Try adjusting your search or filters"
              : "Scheduled appointments will appear here"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Patient", "Phone", "Doctor", "Date", "Time", "Visited"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAppointments.map((a) => (
                  <tr
                    key={a.appointment_id}
                    className={`hover:bg-muted/20 transition-colors ${a.visited ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground leading-tight">{a.patient_name}</p>
                      {isToday(a.appointment_date) && (
                        <span className="text-[10px] font-semibold text-primary">Today</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.patient_phone}</td>
                    <td className="px-4 py-2.5 text-foreground">{a.doctor_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(a.appointment_date)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatTime(a.appointment_time)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={a.visited}
                          onCheckedChange={() => toggleVisited(a.appointment_id, a.visited)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {a.visited ? "Done" : "Pending"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAppointments;