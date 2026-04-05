import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Search, X, User, Stethoscope, Clock, CheckCircle, XCircle, Filter } from "lucide-react";
import { toast } from "sonner";

type Appointment = {
  appointment_id: number;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  specialization: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  visited: boolean;
};

type DateFilter = "all" | "today" | "tomorrow" | "week" | "month" | "past";

const OwnerAppointments = () => {
  const { token } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchAppointments = async () => {
      try {
        const res = await fetch(
          "http://localhost:8000/owner/appointments",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error("Failed to fetch appointments");

        const data = await res.json();

        if (isMounted) {
          setAppointments(Array.isArray(data) ? data : []);
          setFilteredAppointments(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        toast.error(err.message || "Error loading appointments");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (token) {
      fetchAppointments();
    } else {
      setLoading(false);
      toast.error("Not authenticated");
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Filter appointments based on search and date filter
  useEffect(() => {
    let filtered = [...appointments];

    // Search filter
    if (search.trim()) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.patient_name.toLowerCase().includes(searchTerm) ||
        apt.patient_phone.includes(searchTerm) ||
        apt.doctor_name.toLowerCase().includes(searchTerm) ||
        apt.specialization.toLowerCase().includes(searchTerm)
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        aptDate.setHours(0, 0, 0, 0);
        
        switch (dateFilter) {
          case "today":
            return aptDate.getTime() === today.getTime();
          case "tomorrow":
            return aptDate.getTime() === tomorrow.getTime();
          case "week":
            return aptDate >= today && aptDate <= nextWeek;
          case "month":
            return aptDate >= today && aptDate <= nextMonth;
          case "past":
            return aptDate < today;
          default:
            return true;
        }
      });
    }

    setFilteredAppointments(filtered);
  }, [search, dateFilter, appointments]);

  const clearSearch = () => setSearch("");
  const clearDateFilter = () => setDateFilter("all");
  const clearAllFilters = () => {
    setSearch("");
    setDateFilter("all");
  };

  const hasActiveFilters = search !== "" || dateFilter !== "all";

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case "today": return "Today";
      case "tomorrow": return "Tomorrow";
      case "week": return "Next 7 Days";
      case "month": return "Next 30 Days";
      case "past": return "Past Appointments";
      default: return "All Dates";
    }
  };

  // Calculate stats
  const totalAppointments = appointments.length;
  const upcomingAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return aptDate >= today && apt.status !== 'cancelled';
  }).length;
  const completedAppointments = appointments.filter(apt => apt.visited === true).length;
  const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled').length;
  const visitedToday = appointments.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    const today = new Date();
    return aptDate.toDateString() === today.toDateString() && apt.visited === true;
  }).length;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View and manage all patient appointments</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{totalAppointments}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <Clock className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Upcoming</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{upcomingAppointments}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <CheckCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Completed</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{completedAppointments}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20">
              <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Cancelled</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{cancelledAppointments}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <User className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Visited Today</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{visitedToday}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient name, phone, doctor name, or specialization..."
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
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-muted/30 rounded-lg p-3 border border-border space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Date Range</span>
                {dateFilter !== "all" && (
                  <button
                    onClick={clearDateFilter}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All Dates", icon: Calendar },
                  { value: "today", label: "Today", icon: Calendar },
                  { value: "tomorrow", label: "Tomorrow", icon: Calendar },
                  { value: "week", label: "Next 7 Days", icon: Calendar },
                  { value: "month", label: "Next 30 Days", icon: Calendar },
                  { value: "past", label: "Past", icon: Calendar },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setDateFilter(filter.value as DateFilter)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-all ${
                      dateFilter === filter.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted border border-border"
                    }`}
                  >
                    <filter.icon className="h-3 w-3" />
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="w-full h-7 text-xs gap-1"
              >
                <X className="h-3 w-3" />
                Clear All Filters
              </Button>
            )}
          </div>
        )}

        {/* Active filter indicator */}
        {dateFilter !== "all" && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing: <span className="font-medium text-foreground">{getDateFilterLabel()}</span>
            </p>
            <button
              onClick={clearDateFilter}
              className="text-xs text-primary hover:underline"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Results count */}
        {filteredAppointments.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Appointments Table */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? "No appointments match your filters" : "No appointments found"}
            </p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearAllFilters} className="text-xs mt-1">
                Clear all filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Patient</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Doctor</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Specialization</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Visited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAppointments.map((a) => {
                  const appointmentDate = new Date(a.appointment_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isToday = appointmentDate.toDateString() === today.toDateString();
                  const isTomorrow = appointmentDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();
                  const isPast = appointmentDate < today && !a.visited && a.status !== 'cancelled';
                  
                  return (
                    <tr key={a.appointment_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-sm text-foreground">{a.patient_name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {a.patient_phone}
                      </td>
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-sm text-foreground">{a.doctor_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {a.specialization}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-sm ${isToday ? 'font-semibold text-primary' : 'text-foreground'}`}>
                            {new Date(a.appointment_date).toLocaleDateString()}
                          </span>
                          {isToday && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                              Today
                            </span>
                          )}
                          {isTomorrow && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                              Tomorrow
                            </span>
                          )}
                          {isPast && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                              Past
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-foreground">
                        {a.appointment_time}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {a.visited ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">Yes</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">No</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerAppointments;