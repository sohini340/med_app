import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/* ─── Step indicator ─────────────────────────────────────── */
const steps = ["Doctor", "Date", "Time", "Confirm"];

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
const BookAppointment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    searchParams.get("doctor") || ""
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const patientName = user?.name || "";
  const patientPhone = user?.phone || "";

  const currentStep = !selectedDoctorId ? 0 : !selectedDate ? 1 : !selectedTime ? 2 : 3;

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/customer/doctors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDoctors(await res.json());
      } catch {
        toast.error("Failed to load doctors");
      } finally {
        setIsLoading(false);
      }
    };
    if (token) fetchDoctors();
  }, [token]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    const fetchDates = async () => {
      const res = await fetch(
        `${API_BASE_URL}/customer/doctors/${selectedDoctorId}/available-dates`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setAvailableDates(data.available_dates || []);
    };
    fetchDates();
  }, [selectedDoctorId, token]);

  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) { setAvailableSlots([]); return; }
    const fetchSlots = async () => {
      const res = await fetch(
        `${API_BASE_URL}/customer/doctors/${selectedDoctorId}/available-slots?date=${selectedDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.is_available_day && data.available_slots) {
        const formatted = [...new Set(data.available_slots.map((slot: string) => {
          const [h, m] = slot.split(":");
          const hour = parseInt(h);
          const ampm = hour >= 12 ? "PM" : "AM";
          const hour12 = hour % 12 || 12;
          return `${hour12}:${m} ${ampm}`;
        }))] as string[];
        setAvailableSlots(formatted);
      } else {
        setAvailableSlots([]);
      }
    };
    fetchSlots();
  }, [selectedDoctorId, selectedDate, token]);

  const convertTo24 = (time12h: string) => {
    const [time, mod] = time12h.split(" ");
    let [h, m] = time.split(":");
    let hour = parseInt(h);
    if (mod === "PM" && hour !== 12) hour += 12;
    if (mod === "AM" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:${m}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedTime) {
      toast.error("Please complete all fields");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customer/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          doctor_id: parseInt(selectedDoctorId),
          date: selectedDate,
          time: convertTo24(selectedTime),
          patient_name: patientName,
          patient_phone: patientPhone,
        }),
      });
      if (!res.ok) throw new Error("Booking failed");
      toast.success("Appointment confirmed!");
      navigate("/customer/appointments");
    } catch (error: any) {
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

  const selectedDoctor = doctors.find((d) => String(d.id) === selectedDoctorId);
  const nextDates = getNextAvailableDates();

  return (
    <div className="flex justify-center w-full">
    <div className="w-full max-w-2xl">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          Book an Appointment
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Complete each step to schedule your visit
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
                    <SelectItem key={doc.id} value={String(doc.id)}>
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

          {/* ── 2. Date ── */}
          {selectedDoctorId && (
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

          {/* ── 3. Time ── */}
          {selectedDate && (
            <div className="p-5 border-b border-border">
              <Section icon={Clock} title="Select Time">
                {availableSlots.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground -mt-1 mb-2">
                      {availableSlots.length} slots · {format(parseISO(selectedDate), "MMMM d, yyyy")}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2 text-xs font-semibold rounded-lg border-2 transition-all duration-150 focus:outline-none ${
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

          {/* ── 4. Patient info ── */}
          <div className="p-5 border-b border-border">
            <Section icon={User} title="Patient Information">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Full Name
                  </Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{patientName || "—"}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Phone
                  </Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{patientPhone || "—"}</span>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* ── Summary + Submit ── */}
          <div className="p-5 bg-muted/30">
            {selectedDoctor && selectedDate && selectedTime ? (
              <div className="mb-4 p-4 rounded-lg bg-card border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest mb-3">
                  Booking Summary
                </p>
                <div className="space-y-2.5">
                  {[
                    { icon: Stethoscope, label: "Doctor", value: selectedDoctor.name },
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
                      <IndianRupee className="w-3.5 h-3.5" /> Fee
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
              disabled={!selectedDoctorId || !selectedDate || !selectedTime || isSubmitting}
              className="w-full h-10 font-semibold text-sm rounded-lg"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Confirming…</>
              ) : (
                <>Confirm Appointment <ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-2.5">
              By confirming, you agree to the cancellation policy
            </p>
          </div>
        </form>
      </div>
    </div>
    </div>
   
  );
};

export default BookAppointment;