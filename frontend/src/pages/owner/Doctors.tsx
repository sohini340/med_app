import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Plus, Pencil, Trash2, CalendarDays, 
  ChevronDown, ChevronUp, Copy, CheckCircle2, X, Clock, Search, User, Stethoscope, Calendar, Crop
} from "lucide-react";
import ReactCrop, { Crop as ReactCropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const API = "http://localhost:8000/owner/doctors";

type Doctor = {
  doctor_id: number;
  name: string;
  specialization: string;
  available_days: string;
  available_slots: string[];
  fee: number;
  image_base64: string;
};

type TimeSlot = {
  startHour: number;
  startMinute: number;
  startAmPm: "AM" | "PM";
  endHour: number;
  endMinute: number;
  endAmPm: "AM" | "PM";
};

type DaySchedule = {
  enabled: boolean;
  timeSlots: TimeSlot[];
};

type WeeklySchedule = {
  MON: DaySchedule;
  TUE: DaySchedule;
  WED: DaySchedule;
  THU: DaySchedule;
  FRI: DaySchedule;
  SAT: DaySchedule;
  SUN: DaySchedule;
};

// Convert time slot to string format like "09:00 AM - 05:00 PM"
const formatTimeSlotToString = (slot: TimeSlot): string => {
  const startHour12 = slot.startHour === 0 ? 12 : slot.startHour > 12 ? slot.startHour - 12 : slot.startHour;
  const endHour12 = slot.endHour === 0 ? 12 : slot.endHour > 12 ? slot.endHour - 12 : slot.endHour;
  
  const startTime = `${startHour12.toString().padStart(2, '0')}:${slot.startMinute.toString().padStart(2, '0')} ${slot.startAmPm}`;
  const endTime = `${endHour12.toString().padStart(2, '0')}:${slot.endMinute.toString().padStart(2, '0')} ${slot.endAmPm}`;
  
  return `${startTime} - ${endTime}`;
};

// Convert TimeSlot to 24-hour format for storage
const timeSlotTo24Hour = (slot: TimeSlot): string => {
  let startHour24 = slot.startHour;
  if (slot.startAmPm === "PM" && slot.startHour !== 12) startHour24 += 12;
  if (slot.startAmPm === "AM" && slot.startHour === 12) startHour24 = 0;
  
  let endHour24 = slot.endHour;
  if (slot.endAmPm === "PM" && slot.endHour !== 12) endHour24 += 12;
  if (slot.endAmPm === "AM" && slot.endHour === 12) endHour24 = 0;
  
  const startTime = `${startHour24.toString().padStart(2, '0')}:${slot.startMinute.toString().padStart(2, '0')}`;
  const endTime = `${endHour24.toString().padStart(2, '0')}:${slot.endMinute.toString().padStart(2, '0')}`;
  
  return `${startTime}-${endTime}`;
};

// Convert stored time string back to TimeSlot
const stringToTimeSlot = (timeStr: string): TimeSlot => {
  const [start, end] = timeStr.split('-');
  if (!start || !end) return { startHour: 9, startMinute: 0, startAmPm: "AM", endHour: 17, endMinute: 0, endAmPm: "PM" };
  
  const parseTime = (time: string) => {
    const match = time.match(/(\d{1,2}):(\d{2})/);
    if (!match) return { hour: 9, minute: 0 };
    let hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return { hour, minute, ampm: ampm as "AM" | "PM" };
  };
  
  const startTime = parseTime(start);
  const endTime = parseTime(end);
  
  return {
    startHour: startTime.hour,
    startMinute: startTime.minute,
    startAmPm: startTime.ampm,
    endHour: endTime.hour,
    endMinute: endTime.minute,
    endAmPm: endTime.ampm,
  };
};

// Convert schedule to API format (available_days string and available_slots array)
const scheduleToAPIFormat = (schedule: WeeklySchedule): { days: string; slots: string[] } => {
  const enabledDays: string[] = [];
  const allSlots: string[] = [];

  Object.entries(schedule).forEach(([day, data]) => {
    if (data.enabled && data.timeSlots.length > 0) {
      enabledDays.push(day);
      data.timeSlots.forEach(slot => {
        allSlots.push(`${day}|${timeSlotTo24Hour(slot)}`);
      });
    }
  });

  return {
    days: enabledDays.join(','),
    slots: allSlots
  };
};

// Convert API format to weekly schedule
const apiFormatToSchedule = (daysStr: string, slotsArray: string[]): WeeklySchedule => {
  const schedule = JSON.parse(JSON.stringify(defaultSchedule));
  
  if (!daysStr) return schedule;
  
  const enabledDays = daysStr.split(',').map(d => d.trim());
  
  // Clear all days first
  Object.keys(schedule).forEach(day => {
    schedule[day as keyof WeeklySchedule].enabled = false;
    schedule[day as keyof WeeklySchedule].timeSlots = [];
  });
  
  // Enable days from daysStr
  enabledDays.forEach(day => {
    if (schedule[day as keyof WeeklySchedule]) {
      schedule[day as keyof WeeklySchedule].enabled = true;
      schedule[day as keyof WeeklySchedule].timeSlots = [];
    }
  });
  
  // Add time slots
  if (slotsArray && slotsArray.length > 0) {
    slotsArray.forEach(slotStr => {
      const [day, timeRange] = slotStr.split('|');
      if (day && timeRange && schedule[day as keyof WeeklySchedule]) {
        const timeSlot = stringToTimeSlot(timeRange);
        schedule[day as keyof WeeklySchedule].timeSlots.push(timeSlot);
      }
    });
  }
  
  // If no slots were added, add default for enabled days
  enabledDays.forEach(day => {
    if (schedule[day as keyof WeeklySchedule] && schedule[day as keyof WeeklySchedule].timeSlots.length === 0) {
      schedule[day as keyof WeeklySchedule].timeSlots.push({
        startHour: 9, startMinute: 0, startAmPm: "AM",
        endHour: 5, endMinute: 0, endAmPm: "PM"
      });
    }
  });
  
  return schedule;
};

// Default schedule
const defaultSchedule: WeeklySchedule = {
  MON: { enabled: false, timeSlots: [] },
  TUE: { enabled: false, timeSlots: [] },
  WED: { enabled: false, timeSlots: [] },
  THU: { enabled: false, timeSlots: [] },
  FRI: { enabled: false, timeSlots: [] },
  SAT: { enabled: false, timeSlots: [] },
  SUN: { enabled: false, timeSlots: [] },
};

// Image cropping component
const ImageCropper = ({ 
  imageSrc, 
  onCropComplete 
}: { 
  imageSrc: string; 
  onCropComplete: (croppedImageBase64: string) => void;
}) => {
  const [crop, setCrop] = useState<ReactCropType>({
    unit: 'px',
    width: 200,
    height: 200,
    x: 0,
    y: 0,
  });
  const [completedCrop, setCompletedCrop] = useState<any>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const getCroppedImg = () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Create circular crop
    ctx.beginPath();
    ctx.arc(
      completedCrop.width / 2,
      completedCrop.height / 2,
      completedCrop.width / 2,
      0,
      2 * Math.PI
    );
    ctx.clip();
    
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(base64Image);
  };

  useEffect(() => {
    if (completedCrop) {
      getCroppedImg();
    }
  }, [completedCrop]);

  return (
    <div className="space-y-4">
      <ReactCrop
        crop={crop}
        onChange={(c) => setCrop(c)}
        onComplete={(c) => setCompletedCrop(c)}
        aspect={1}
        circularCrop
        className="max-h-[400px] overflow-auto"
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Crop preview"
          className="max-w-full h-auto"
        />
      </ReactCrop>
      <p className="text-xs text-muted-foreground text-center">
        Drag to adjust the circular crop area for doctor's face
      </p>
    </div>
  );
};

const DoctorsManagement = () => {
  const { token } = useAuthStore();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"name" | "specialization" | "both">("both");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [editDoc, setEditDoc] = useState<Doctor | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Doctor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string>("");

  const [form, setForm] = useState({
    name: "",
    specialization: "",
    fee: "",
    image_base64: "",
  });

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(defaultSchedule);

  const weekDays = [
    { key: "MON", label: "Monday" },
    { key: "TUE", label: "Tuesday" },
    { key: "WED", label: "Wednesday" },
    { key: "THU", label: "Thursday" },
    { key: "FRI", label: "Friday" },
    { key: "SAT", label: "Saturday" },
    { key: "SUN", label: "Sunday" },
  ];

  const fetchDoctors = async () => {
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch doctors");

      const data = await res.json();
      setDoctors(Array.isArray(data) ? data : []);
      setFilteredDoctors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Error loading doctors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDoctors();
    else {
      setLoading(false);
      toast.error("Not authenticated");
    }
  }, [token]);

  // Filter doctors based on search and date
  useEffect(() => {
    let filtered = [...doctors];

    // Apply search filter
    if (search.trim() !== "") {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(doctor => {
        if (searchType === "name") {
          return doctor.name.toLowerCase().includes(searchTerm);
        } else if (searchType === "specialization") {
          return doctor.specialization.toLowerCase().includes(searchTerm);
        } else {
          return doctor.name.toLowerCase().includes(searchTerm) ||
                 doctor.specialization.toLowerCase().includes(searchTerm);
        }
      });
    }

    // Apply date filter (filter doctors available on selected date)
    if (selectedDate) {
      const date = new Date(selectedDate);
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
      filtered = filtered.filter(doctor => 
        doctor.available_days && doctor.available_days.includes(dayOfWeek)
      );
    }

    setFilteredDoctors(filtered);
  }, [search, searchType, doctors, selectedDate]);

  const clearSearch = () => {
    setSearch("");
    setSelectedDate("");
  };

  const handleEdit = (doctor: Doctor) => {
    setForm({
      name: doctor.name,
      specialization: doctor.specialization,
      fee: String(doctor.fee),
      image_base64: doctor.image_base64 || "",
    });
    setImagePreview(doctor.image_base64 || "");
    setImageFile(null);
    
    const schedule = apiFormatToSchedule(doctor.available_days, doctor.available_slots || []);
    setWeeklySchedule(schedule);
    
    setEditDoc(doctor);
    setShowModal(true);
  };

  const handleAdd = () => {
    setForm({
      name: "",
      specialization: "",
      fee: "",
      image_base64: "",
    });
    setImagePreview("");
    setImageFile(null);
    setWeeklySchedule(defaultSchedule);
    setEditDoc(null);
    setShowModal(true);
  };

  const toggleDay = (dayKey: string) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey as keyof WeeklySchedule],
        enabled: !prev[dayKey as keyof WeeklySchedule].enabled
      }
    }));
  };

  const addTimeSlot = (dayKey: string) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey as keyof WeeklySchedule],
        timeSlots: [
          ...prev[dayKey as keyof WeeklySchedule].timeSlots,
          { startHour: 9, startMinute: 0, startAmPm: "AM", endHour: 5, endMinute: 0, endAmPm: "PM" }
        ]
      }
    }));
  };

  const removeTimeSlot = (dayKey: string, slotIndex: number) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey as keyof WeeklySchedule],
        timeSlots: prev[dayKey as keyof WeeklySchedule].timeSlots.filter((_, i) => i !== slotIndex)
      }
    }));
  };

  const updateTimeSlot = (dayKey: string, slotIndex: number, field: keyof TimeSlot, value: any) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey as keyof WeeklySchedule],
        timeSlots: prev[dayKey as keyof WeeklySchedule].timeSlots.map((slot, i) =>
          i === slotIndex ? { ...slot, [field]: value } : slot
        )
      }
    }));
  };

  const applyToAllDays = () => {
    const enabledDays = Object.entries(weeklySchedule).filter(([_, data]) => data.enabled);
    if (enabledDays.length === 0) {
      toast.error("No enabled days to apply to");
      return;
    }
    
    const firstEnabledSlots = enabledDays[0][1].timeSlots;
    const newSchedule = { ...weeklySchedule };
    
    Object.keys(newSchedule).forEach(day => {
      if (newSchedule[day as keyof WeeklySchedule].enabled) {
        newSchedule[day as keyof WeeklySchedule].timeSlots = JSON.parse(JSON.stringify(firstEnabledSlots));
      }
    });
    
    setWeeklySchedule(newSchedule);
    toast.success("Time slots applied to all enabled days");
  };

  const getEnabledCount = () => {
    return Object.values(weeklySchedule).filter(day => day.enabled).length;
  };

  const getTotalTimeSlots = () => {
    return Object.values(weeklySchedule).reduce((total, day) => total + (day.enabled ? day.timeSlots.length : 0), 0);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setTempImageSrc(base64String);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedImageBase64: string) => {
    setImagePreview(croppedImageBase64);
    setForm({ ...form, image_base64: croppedImageBase64 });
    setShowCropper(false);
    setTempImageSrc("");
  };

  const handleSave = async () => {
    if (!form.name || !form.specialization) {
      toast.error("Name & specialization required");
      return;
    }

    if (!form.fee || parseFloat(form.fee) <= 0) {
      toast.error("Valid consultation fee required");
      return;
    }

    const enabledDays = Object.values(weeklySchedule).some(day => day.enabled);
    if (!enabledDays) {
      toast.error("Please enable at least one day");
      return;
    }

    setSaving(true);

    const { days, slots } = scheduleToAPIFormat(weeklySchedule);

    const payload = {
      name: form.name,
      specialization: form.specialization,
      fee: parseFloat(form.fee),
      available_days: days,
      available_slots: slots,
      image_base64: form.image_base64,
    };

    try {
      const res = await fetch(
        editDoc ? `${API}/${editDoc.doctor_id}` : API,
        {
          method: editDoc ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Save failed");

      toast.success(editDoc ? "Doctor updated successfully!" : "Doctor added successfully!");

      setForm({
        name: "",
        specialization: "",
        fee: "",
        image_base64: "",
      });
      setImagePreview("");
      setImageFile(null);
      setWeeklySchedule(defaultSchedule);
      setEditDoc(null);
      setShowModal(false);
      fetchDoctors();
    } catch (err: any) {
      toast.error(err.message || "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;

    try {
      const res = await fetch(`${API}/${deleteDoc.doctor_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Doctor deleted successfully!");

      setDoctors((prev) =>
        prev.filter((d) => d.doctor_id !== deleteDoc.doctor_id)
      );
    } catch (err: any) {
      toast.error(err.message || "Delete error");
    } finally {
      setDeleteDoc(null);
    }
  };

  // Get unique specializations for stats
  const uniqueSpecializations = [...new Set(doctors.map(d => d.specialization))];
  const totalFee = doctors.reduce((sum, d) => sum + d.fee, 0);
  const avgFee = doctors.length > 0 ? totalFee / doctors.length : 0;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Doctors Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage doctor profiles, schedules, and availability</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="gap-1.5 h-8 text-xs">
          <Plus className="h-3 w-3" />
          Add Doctor
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Doctors</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{doctors.length}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Stethoscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Specializations</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{uniqueSpecializations.length}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <CalendarDays className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Schedule Slots</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {doctors.reduce((sum, d) => sum + (d.available_slots?.length || 0), 0)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Avg Consultation Fee</span>
          </div>
          <p className="text-xl font-semibold text-foreground">₹{avgFee.toFixed(0)}</p>
        </div>
      </div>

      {/* Search Section */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search by ${searchType === "name" ? "doctor name" : searchType === "specialization" ? "specialization" : "name or specialization"}...`}
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
          <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Both</SelectItem>
              <SelectItem value="name">Name only</SelectItem>
              <SelectItem value="specialization">Specialization only</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showDateFilter ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="h-9 gap-1"
          >
            <Calendar className="h-4 w-4" />
            Date
          </Button>
        </div>

        {/* Date Filter */}
        {showDateFilter && (
          <div className="flex gap-2 items-center p-3 bg-muted/30 rounded-lg border border-border">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Filter by availability date:</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate("")}
                className="h-8 px-2"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Doctors Grid */}
      {filteredDoctors.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <Stethoscope className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || selectedDate ? "No doctors match your search criteria" : "No doctors found"}
            </p>
            {(search || selectedDate) && (
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your search filters
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDoctors.map((d) => (
            <div key={d.doctor_id} className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all">
              <div className="relative">
                {d.image_base64 && (
                  <div className="w-full h-48 overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
                    <img 
                      src={d.image_base64} 
                      alt={d.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{d.name}</h3>
                    <p className="text-sm text-primary mt-0.5">{d.specialization}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Consultation Fee</p>
                    <p className="font-semibold text-lg text-primary">₹{d.fee}</p>
                  </div>
                </div>
                
                <div className="space-y-2 mt-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Available Days</p>
                    <div className="flex flex-wrap gap-1">
                      {d.available_days ? d.available_days.split(',').map(day => (
                        <span key={day} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {day}
                        </span>
                      )) : <span className="text-xs text-muted-foreground">Not set</span>}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Time Slots</p>
                    <p className="text-sm text-muted-foreground">
                      {d.available_slots?.length || 0} slots available
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(d)} className="flex-1 gap-1 h-8 text-xs">
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteDoc(d)} className="flex-1 gap-1 h-8 text-xs">
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editDoc ? "Edit Doctor" : "Add New Doctor"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Fill in the doctor details and schedule
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Full Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Dr. John Doe"
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Specialization *</Label>
                  <Input
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    placeholder="Cardiologist"
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Consultation Fee (₹) *</Label>
                  <Input
                    type="number"
                    value={form.fee}
                    onChange={(e) => setForm({ ...form, fee: e.target.value })}
                    placeholder="500"
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
              </div>
            </div>

            {/* Profile Image with Cropping */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Profile Image (Optional)</h3>
              
              <div>
                <Label className="text-xs text-muted-foreground">Upload Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="mt-1.5 h-9 text-sm bg-muted/30 border-border/60"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Upload a photo and crop it to focus on the doctor's face (circular crop)
                </p>
              </div>
              
              {imagePreview && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <div className="mt-1 p-2 border rounded-lg bg-muted/20 inline-block">
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="h-24 w-24 object-cover rounded-full ring-2 ring-primary/20"
                      />
                      <div className="absolute inset-0 rounded-full ring-2 ring-primary/40 pointer-events-none"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Schedule with Time Slots */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Weekly Schedule</h3>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {getEnabledCount()} days • {getTotalTimeSlots()} slots
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={applyToAllDays} className="h-7 text-xs gap-1">
                  <Copy className="h-3 w-3" />
                  Apply to all days
                </Button>
              </div>

              <div className="space-y-2">
                {weekDays.map((day) => {
                  const schedule = weeklySchedule[day.key as keyof WeeklySchedule];
                  const isExpanded = expandedDay === day.key;
                  
                  return (
                    <div key={day.key} className="border border-border rounded-lg overflow-hidden">
                      <div 
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setExpandedDay(isExpanded ? null : day.key)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={schedule.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleDay(day.key);
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <span className={`text-sm font-medium ${schedule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {day.label}
                          </span>
                          {schedule.enabled && schedule.timeSlots.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {schedule.timeSlots.map(slot => formatTimeSlotToString(slot)).join(', ')}
                            </span>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                      
                      {isExpanded && schedule.enabled && (
                        <div className="p-3 border-t border-border bg-muted/20 space-y-3">
                          {schedule.timeSlots.map((slot, slotIndex) => (
                            <div key={slotIndex} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                              <div className="flex-1">
                                <Label className="text-xs">Start Time</Label>
                                <div className="flex gap-2 mt-1">
                                  <div className="flex-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      max="12"
                                      value={slot.startHour}
                                      onChange={(e) => updateTimeSlot(day.key, slotIndex, 'startHour', parseInt(e.target.value) || 0)}
                                      className="h-8 text-center text-sm"
                                      placeholder="Hour"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="59"
                                      value={slot.startMinute}
                                      onChange={(e) => updateTimeSlot(day.key, slotIndex, 'startMinute', parseInt(e.target.value) || 0)}
                                      className="h-8 text-center text-sm"
                                      placeholder="Min"
                                    />
                                  </div>
                                  <select
                                    value={slot.startAmPm}
                                    onChange={(e) => updateTimeSlot(day.key, slotIndex, 'startAmPm', e.target.value as "AM" | "PM")}
                                    className="px-2 py-1 border border-border rounded-md bg-background text-sm"
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">End Time</Label>
                                <div className="flex gap-2 mt-1">
                                  <div className="flex-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      max="12"
                                      value={slot.endHour}
                                      onChange={(e) => updateTimeSlot(day.key, slotIndex, 'endHour', parseInt(e.target.value) || 0)}
                                      className="h-8 text-center text-sm"
                                      placeholder="Hour"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="59"
                                      value={slot.endMinute}
                                      onChange={(e) => updateTimeSlot(day.key, slotIndex, 'endMinute', parseInt(e.target.value) || 0)}
                                      className="h-8 text-center text-sm"
                                      placeholder="Min"
                                    />
                                  </div>
                                  <select
                                    value={slot.endAmPm}
                                    onChange={(e) => updateTimeSlot(day.key, slotIndex, 'endAmPm', e.target.value as "AM" | "PM")}
                                    className="px-2 py-1 border border-border rounded-md bg-background text-sm"
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeTimeSlot(day.key, slotIndex)}
                                className="mt-5 text-red-500 hover:text-red-600 h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addTimeSlot(day.key)}
                            className="w-full h-8 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Time Slot
                          </Button>
                        </div>
                      )}
                      
                      {isExpanded && !schedule.enabled && (
                        <div className="p-3 border-t border-border bg-muted/20 text-center text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 inline mr-1" />
                          Enable this day to add time slots
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1.5">
              {saving ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                editDoc ? "Update Doctor" : "Add Doctor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Cropper Dialog */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Crop Doctor's Face</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Adjust the circular crop to focus on the doctor's face
            </p>
          </DialogHeader>
          
          {tempImageSrc && (
            <ImageCropper 
              imageSrc={tempImageSrc} 
              onCropComplete={handleCropComplete}
            />
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCropper(false)} className="h-8 text-xs">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <Dialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Confirm Deletion</DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deleteDoc?.name}</span>? 
            This action cannot be undone.
          </p>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteDoc(null)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="h-8 text-xs gap-1.5">
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorsManagement;