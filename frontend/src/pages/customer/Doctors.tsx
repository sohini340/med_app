import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Stethoscope, Calendar, Clock, IndianRupee } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const CustomerDoctors = () => {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { token } = useAuthStore();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/customer/doctors`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch doctors");
        const data = await res.json();
        setDoctors(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [token]);

  if (loading) return <CardSkeleton count={6} />;

  // Helper to format time slots for display
  const formatTimeSlots = (slots: string[]) => {
    if (!slots || slots.length === 0) return "Time not specified";
    
    // Extract unique time ranges from slots (e.g., "MON|09:00-12:00")
    const timeRanges = [...new Set(slots.map(slot => {
      const parts = slot.split('|');
      return parts[1] || parts[0];
    }))];
    
    return timeRanges.join(', ');
  };

  return (
    <div className="max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Doctors
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and book available doctors
        </p>
      </div>

      {doctors.length === 0 ? (
        <EmptyState
          title="No doctors available"
          description="Please check again later."
          icon={<Stethoscope className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className="group rounded-xl border border-border bg-card p-5 
              hover:border-muted-foreground/20 hover:shadow-sm transition-all"
            >
              {/* Top */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {doc.image_base64 ? (
                    <img
                      src={doc.image_base64}
                      alt={doc.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Stethoscope className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {doc.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {doc.specialization || "General"}
                  </p>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-1.5 text-xs text-muted-foreground mb-5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span>{doc.available_days || "Days not specified"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span className="line-clamp-1">{formatTimeSlots(doc.available_slots)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 pt-1 border-t border-border">
                  <IndianRupee className="h-3 w-3" />
                  <span className="text-foreground font-medium">
                    ₹{doc.fee || 0}
                  </span>
                </div>
              </div>

              {/* Action */}
              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={() =>
                  navigate(`/customer/book-appointment?doctor=${doc.id}`)
                }
              >
                <Calendar className="h-4 w-4 mr-2" />
                Book Appointment
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerDoctors;