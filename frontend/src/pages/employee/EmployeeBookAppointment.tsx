import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Stethoscope,
  Loader2,
  ChevronRight,
  CheckCircle2,
  IndianRupee,
  Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/* ─── Step indicator ─────────────────────────────────────── */
const steps = ["Doctor", "Patient", "Date", "Time", "Confirm"];

const StepIndicator = ({ current }: { current: number }) => (
  <div className="flex items-center mb-6">
    {steps.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                  ? "bg-foreground text-background ring-4 ring-foreground/10"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-[11px] font-medium ${
                active
                  ? "text-foreground"
                  : done
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-12 h-px mx-1 mb-4 transition-all duration-500 ${
                done ? "bg-emerald-400" : "bg-border"
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);

/* ─── Section wrapper ────────────────────────────────────── */
const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 pb-2 border-b border-border">
      <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-background" />
      </div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
    </div>
    {children}
  </div>
);

/* ─── Main component ─────────────────────────────────────── */
const EmployeeBookAppointment = () => {
  const { token, user } = useAuthStore();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const currentStep = !selectedDoctorId ? 0 : !patientName ? 1 : !selectedDate ? 2 : !selectedTime ? 3 : 4;

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/employee/doctors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load doctors");
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Failed to load doctors");
      } finally {
        setIsLoading(false);
      }
    };
    if (token) fetchDoctors();
  }, [token]);

  // Fetch available dates when doctor is selected
  useEffect(() => {
    if (!selectedDoctorId) return;
    const fetchDates = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/employee/doctors/${selectedDoctorId}/available-dates`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Failed to load dates");
        const data = await res.json();
        setAvailableDates(data.available_dates || []);
      } catch (error) {
        toast.error("Failed to load available dates");
        setAvailableDates([]);
      }
    };
    fetchDates();
  }, [selectedDoctorId, token]);

  // Fetch available slots - remove duplicates and keep 24-hour format
  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) {
      setAvailableSlots([]);
      return;
    }
    const fetchSlots = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/employee/doctors/${selectedDoctorId}/available-slots?date=${selectedDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Failed to load slots");
        const data = await res.json();
        if (data.is_available_day && data.available_slots) {
          // Remove duplicates using Set
          const uniqueSlots = [...new Set(data.available_slots)];
          // Sort slots by time
          uniqueSlots.sort((a, b) => a.localeCompare(b));
          setAvailableSlots(uniqueSlots);
        } else {
          setAvailableSlots([]);
        }
      } catch (error) {
        toast.error("Failed to load available slots");
        setAvailableSlots([]);
      }
    };
    fetchSlots();
  }, [selectedDoctorId, selectedDate, token]);

  // Search for existing customers
  const searchCustomers = async () => {
    if (!searchCustomer.trim() || searchCustomer.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/employee/customers/search?q=${encodeURIComponent(searchCustomer)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchCustomer.length >= 2) {
        searchCustomers();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchCustomer]);

  const selectCustomer = (customer: any) => {
    setPatientName(customer.name);
    setPatientPhone(customer.phone);
    setSearchCustomer("");
    setSearchResults([]);
    toast.success(`Customer ${customer.name} selected`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedTime || !patientName || !patientPhone) {
      toast.error("Please complete all fields");
      return;
    }
    setIsSubmitting(true);
    try {
      // Format datetime as YYYY-MM-DDTHH:MM:SS (without milliseconds)
      const formattedDateTime = `${selectedDate}T${selectedTime}:00`;
      
      console.log("Sending datetime:", formattedDateTime); // Debug log
      
      const res = await fetch(`${API_BASE_URL}/employee/appointments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          doctor_id: parseInt(selectedDoctorId),
          appointment_datetime: formattedDateTime,
          patient_name: patientName,
          patient_phone: patientPhone,
          booked_by_employee: true,
          employee_id: user?.user_id,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Booking failed");
      }
      
      toast.success(`Appointment booked for ${patientName}!`);
      // Reset form
      setSelectedDoctorId("");
      setSelectedDate("");
      setSelectedTime("");
      setPatientName("");
      setPatientPhone("");
      setAvailableSlots([]);
      setAvailableDates([]);
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNextAvailableDates = () => {
    const today = new Date();
    const nextDates = [];
    for (let i = 0; i < 21; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = format(date, "yyyy-MM-dd");
      if (availableDates.includes(dateStr)) nextDates.push(date);
      if (nextDates.length === 7) break;
    }
    return nextDates;
  };

  const selectedDoctor = doctors.find((d) => String(d.doctor_id || d.id) === selectedDoctorId);
  const nextDates = getNextAvailableDates();

  return (
    <div className="flex justify-center w-full">
      <div className="w-full max-w-2xl">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Book Appointment for Customer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete each step to schedule a customer appointment
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={currentStep} />

        {/* Card */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit}>

            {/* ── 1. Doctor ── */}
            <div className="p-5 border-b border-border">
              <Section icon={Stethoscope} title="Select Doctor">
                <Select
                  value={selectedDoctorId}
                  onValueChange={(v) => {
                    setSelectedDoctorId(v);
                    setSelectedDate("");
                    setSelectedTime("");
                  }}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder={isLoading ? "Loading doctors…" : "Choose a doctor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doc) => (
                      <SelectItem key={doc.doctor_id || doc.id} value={String(doc.doctor_id || doc.id)}>
                        <span className="font-medium">{doc.name}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs">· {doc.specialization}</span>
                        <span className="text-muted-foreground ml-2 text-xs">₹{doc.fee}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedDoctor && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border mt-2">
                    <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center text-background text-xs font-bold shrink-0">
                      {selectedDoctor.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{selectedDoctor.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedDoctor.specialization}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">₹{selectedDoctor.fee}</p>
                      <p className="text-[11px] text-muted-foreground">Consult fee</p>
                    </div>
                  </div>
                )}
              </Section>
            </div>

            {/* ── 2. Patient Information ── */}
            {selectedDoctorId && (
              <div className="p-5 border-b border-border">
                <Section icon={User} title="Patient Information">
                  {/* Search existing customer */}
                  <div className="mb-4">
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Search Existing Customer
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or phone..."
                        value={searchCustomer}
                        onChange={(e) => setSearchCustomer(e.target.value)}
                        className="pl-9 h-9 text-sm bg-muted/30 border-border/60"
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-2 border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        {searchResults.map((customer) => (
                          <button
                            key={customer.user_id}
                            type="button"
                            onClick={() => selectCustomer(customer)}
                            className="w-full text-left p-2 hover:bg-muted/50 transition-colors border-b last:border-0"
                          >
                            <p className="text-sm font-medium text-foreground">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-center text-xs text-muted-foreground mb-3">— OR —</div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Patient Name *
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Enter patient name"
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          className="pl-9 h-9 text-sm bg-muted/30 border-border/60"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Phone Number *
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="+91 00000 00000"
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value)}
                          className="pl-9 h-9 text-sm bg-muted/30 border-border/60"
                        />
                      </div>
                    </div>
                  </div>
                </Section>
              </div>
            )}

            {/* ── 3. Date ── */}
            {selectedDoctorId && patientName && (
              <div className="p-5 border-b border-border">
                <Section icon={Calendar} title="Select Date">
                  {nextDates.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {nextDates.map((date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        const isSelected = selectedDate === dateStr;
                        const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => { setSelectedDate(dateStr); setSelectedTime(""); }}
                            className={`flex-shrink-0 w-[58px] py-2.5 text-center rounded-lg border-2 transition-all duration-200 focus:outline-none ${
                              isSelected
                                ? "bg-foreground text-background border-foreground shadow-sm"
                                : "border-border hover:border-foreground/40 hover:bg-muted text-foreground"
                            }`}
                          >
                            <div className={`text-[10px] font-semibold uppercase tracking-wide ${isSelected ? "opacity-60" : "text-muted-foreground"}`}>
                              {format(date, "EEE")}
                            </div>
                            <div className="text-lg font-bold leading-tight mt-0.5">
                              {format(date, "d")}
                            </div>
                            <div className={`text-[10px] mt-0.5 ${isSelected ? "opacity-60" : "text-muted-foreground"}`}>
                              {format(date, "MMM")}
                            </div>
                            {isToday && (
                              <div className={`text-[9px] font-semibold mt-0.5 ${isSelected ? "text-emerald-300" : "text-emerald-500"}`}>
                                Today
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 rounded-lg border border-dashed border-border text-muted-foreground text-sm">
                      No available dates for this doctor
                    </div>
                  )}
                </Section>
              </div>
            )}

            {/* ── 4. Time (24-hour format, no duplicates) ── */}
            {selectedDate && (
              <div className="p-5 border-b border-border">
                <Section icon={Clock} title="Select Time">
                  {availableSlots.length > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground -mt-1 mb-2">
                        {availableSlots.length} slot{availableSlots.length !== 1 ? "s" : ""} available
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`py-2 text-sm font-medium rounded-lg border-2 transition-all duration-150 focus:outline-none ${
                              selectedTime === slot
                                ? "bg-foreground text-background border-foreground shadow-sm"
                                : "border-border text-foreground hover:border-foreground/40 hover:bg-muted"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-6 rounded-lg border border-dashed border-border text-muted-foreground text-sm">
                      No slots available for this date
                    </div>
                  )}
                </Section>
              </div>
            )}

            {/* ── 5. Summary + Submit ── */}
            <div className="p-5 bg-muted/30">
              {selectedDoctor && selectedDate && selectedTime && patientName ? (
                <div className="mb-4 p-4 rounded-lg bg-card border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest mb-3">
                    Booking Summary
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { icon: Stethoscope, label: "Doctor", value: selectedDoctor.name },
                      { icon: User, label: "Patient", value: patientName },
                      { icon: Phone, label: "Phone", value: patientPhone },
                      { icon: Calendar, label: "Date", value: format(parseISO(selectedDate), "MMMM d, yyyy") },
                      { icon: Clock, label: "Time", value: selectedTime },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </span>
                        <span className="font-semibold text-foreground">{value}</span>
                      </div>
                    ))}
                    <div className="pt-2 mt-1 border-t border-border flex items-center justify-between">
                      <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                        <IndianRupee className="w-3.5 h-3.5" /> Consultation Fee
                      </span>
                      <span className="text-base font-bold text-foreground">₹{selectedDoctor.fee}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                  Complete the steps above to see your booking summary
                </div>
              )}

              <Button
                type="submit"
                disabled={!selectedDoctorId || !selectedDate || !selectedTime || !patientName || !patientPhone || isSubmitting}
                className="w-full h-10 font-semibold text-sm rounded-lg"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Booking Appointment…</>
                ) : (
                  <>Book Appointment <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-2.5">
                By confirming, you book this appointment on behalf of the customer
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmployeeBookAppointment;