import { useEffect, useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, CalendarDays,
  ChevronDown, ChevronUp, Copy, CheckCircle2, X, Clock, Search, User, Stethoscope, Calendar,
  Link, Upload, Move, Maximize2, Minimize2,
} from "lucide-react";

const API = "http://localhost:8000/owner/doctors";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type DaySchedule = { enabled: boolean; timeSlots: TimeSlot[] };

type WeeklySchedule = {
  MON: DaySchedule; TUE: DaySchedule; WED: DaySchedule; THU: DaySchedule;
  FRI: DaySchedule; SAT: DaySchedule; SUN: DaySchedule;
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

const formatTimeSlotToString = (slot: TimeSlot): string => {
  const fmt = (h: number, m: number, ap: string) => {
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ap}`;
  };
  return `${fmt(slot.startHour, slot.startMinute, slot.startAmPm)} – ${fmt(slot.endHour, slot.endMinute, slot.endAmPm)}`;
};

const timeSlotTo24Hour = (slot: TimeSlot): string => {
  let sh = slot.startHour;
  if (slot.startAmPm === "PM" && sh !== 12) sh += 12;
  if (slot.startAmPm === "AM" && sh === 12) sh = 0;
  let eh = slot.endHour;
  if (slot.endAmPm === "PM" && eh !== 12) eh += 12;
  if (slot.endAmPm === "AM" && eh === 12) eh = 0;
  return `${sh.toString().padStart(2, "0")}:${slot.startMinute.toString().padStart(2, "0")}-${eh.toString().padStart(2, "0")}:${slot.endMinute.toString().padStart(2, "0")}`;
};

const stringToTimeSlot = (timeStr: string): TimeSlot => {
  const [start, end] = timeStr.split("-");
  if (!start || !end) return { startHour: 9, startMinute: 0, startAmPm: "AM", endHour: 17, endMinute: 0, endAmPm: "PM" };
  const parse = (t: string) => {
    const m = t.match(/(\d{1,2}):(\d{2})/);
    if (!m) return { hour: 9, minute: 0, ampm: "AM" as "AM" | "PM" };
    let h = parseInt(m[1]), min = parseInt(m[2]);
    const ap: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return { hour: h, minute: min, ampm: ap };
  };
  const s = parse(start), e = parse(end);
  return { startHour: s.hour, startMinute: s.minute, startAmPm: s.ampm, endHour: e.hour, endMinute: e.minute, endAmPm: e.ampm };
};

const scheduleToAPIFormat = (schedule: WeeklySchedule) => {
  const days: string[] = [], slots: string[] = [];
  Object.entries(schedule).forEach(([day, data]) => {
    if (data.enabled && data.timeSlots.length > 0) {
      days.push(day);
      data.timeSlots.forEach((slot) => slots.push(`${day}|${timeSlotTo24Hour(slot)}`));
    }
  });
  return { days: days.join(","), slots };
};

const defaultSchedule: WeeklySchedule = {
  MON: { enabled: false, timeSlots: [] }, TUE: { enabled: false, timeSlots: [] },
  WED: { enabled: false, timeSlots: [] }, THU: { enabled: false, timeSlots: [] },
  FRI: { enabled: false, timeSlots: [] }, SAT: { enabled: false, timeSlots: [] },
  SUN: { enabled: false, timeSlots: [] },
};

const apiFormatToSchedule = (daysStr: string, slotsArray: string[]): WeeklySchedule => {
  const schedule: WeeklySchedule = JSON.parse(JSON.stringify(defaultSchedule));
  if (!daysStr) return schedule;
  daysStr.split(",").map((d) => d.trim()).forEach((day) => {
    if (schedule[day as keyof WeeklySchedule]) {
      schedule[day as keyof WeeklySchedule].enabled = true;
      schedule[day as keyof WeeklySchedule].timeSlots = [];
    }
  });
  (slotsArray || []).forEach((s) => {
    const [day, range] = s.split("|");
    if (day && range && schedule[day as keyof WeeklySchedule])
      schedule[day as keyof WeeklySchedule].timeSlots.push(stringToTimeSlot(range));
  });
  Object.keys(schedule).forEach((day) => {
    const d = schedule[day as keyof WeeklySchedule];
    if (d.enabled && d.timeSlots.length === 0)
      d.timeSlots.push({ startHour: 9, startMinute: 0, startAmPm: "AM", endHour: 5, endMinute: 0, endAmPm: "PM" });
  });
  return schedule;
};

// ─── Freehand Circle Cropper ─────────────────────────────────────────────────

const ImageCropper = ({
  imageSrc,
  onCropComplete,
  onCancel,
  initialCrop, // Add initial crop position
}: {
  imageSrc: string;
  onCropComplete: (base64: string) => void;
  onCancel: () => void;
  initialCrop?: { x: number; y: number; radius: number } | null;
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0, radius: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const maxWidth = rect.width - 40;
    const maxHeight = rect.height - 40;
    
    let displayWidth = img.naturalWidth;
    let displayHeight = img.naturalHeight;
    
    if (displayWidth > maxWidth) {
      displayHeight = (displayHeight * maxWidth) / displayWidth;
      displayWidth = maxWidth;
    }
    if (displayHeight > maxHeight) {
      displayWidth = (displayWidth * maxHeight) / displayHeight;
      displayHeight = maxHeight;
    }
    
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    setDisplaySize({ width: displayWidth, height: displayHeight });
    
    // If we have initial crop, use it (scaled to display size)
    if (initialCrop && initialCrop.radius > 0) {
      const scaleX = displayWidth / img.naturalWidth;
      const scaleY = displayHeight / img.naturalHeight;
      setCrop({
        x: initialCrop.x * scaleX,
        y: initialCrop.y * scaleY,
        radius: initialCrop.radius * Math.min(scaleX, scaleY),
      });
    } else {
      // Set initial crop to center
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;
      const radius = Math.min(displayWidth, displayHeight) / 3;
      setCrop({ x: centerX, y: centerY, radius });
    }
    setIsImageLoaded(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !isImageLoaded) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (target.classList.contains('resize-handle')) {
      setIsResizing(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const dx = x - crop.x;
    const dy = y - crop.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= crop.radius + 10) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !isImageLoaded) return;

    if (isDragging) {
      const newX = Math.max(crop.radius, Math.min(e.clientX - dragStart.x, displaySize.width - crop.radius));
      const newY = Math.max(crop.radius, Math.min(e.clientY - dragStart.y, displaySize.height - crop.radius));
      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    }
    
    if (isResizing) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - crop.x;
      const dy = y - crop.y;
      const newRadius = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = Math.min(
        crop.x, 
        displaySize.width - crop.x,
        crop.y,
        displaySize.height - crop.y
      );
      setCrop(prev => ({ 
        ...prev, 
        radius: Math.max(20, Math.min(newRadius, maxRadius))
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const applyCrop = () => {
    if (!imageRef.current || !isImageLoaded) return;
    
    const image = imageRef.current;
    const canvas = document.createElement("canvas");
    const SIZE = 300;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaleX = image.naturalWidth / displaySize.width;
    const scaleY = image.naturalHeight / displaySize.height;

    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, 2 * Math.PI);
    ctx.clip();

    ctx.drawImage(
      image,
      (crop.x - crop.radius) * scaleX,
      (crop.y - crop.radius) * scaleY,
      crop.radius * 2 * scaleX,
      crop.radius * 2 * scaleY,
      0, 0, SIZE, SIZE
    );
    
    const result = canvas.toDataURL("image/jpeg", 0.92);
    onCropComplete(result);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Move className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Drag the circle to reposition. Drag the bottom-right handle to resize.
        </p>
      </div>
      
      <div 
        ref={containerRef}
        className="relative flex justify-center items-center bg-muted/30 rounded-lg overflow-hidden p-2 max-h-[380px] min-h-[300px]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="relative" style={{ width: displaySize.width, height: displaySize.height }}>
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop"
            onLoad={onImageLoad}
            className="block w-full h-full object-contain select-none"
            draggable={false}
          />
          
          {isImageLoaded && (
            <>
              {/* Dark overlay outside circle */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ width: displaySize.width, height: displaySize.height }}
              >
                <defs>
                  <clipPath id="circleClip">
                    <rect x="0" y="0" width={displaySize.width} height={displaySize.height} />
                    <circle cx={crop.x} cy={crop.y} r={crop.radius} />
                  </clipPath>
                </defs>
                <rect 
                  x="0" 
                  y="0" 
                  width={displaySize.width} 
                  height={displaySize.height} 
                  fill="rgba(0,0,0,0.5)"
                  clipPath="url(#circleClip)"
                />
              </svg>
              
              {/* Circle border */}
              <div 
                className="absolute pointer-events-none"
                style={{
                  left: crop.x - crop.radius,
                  top: crop.y - crop.radius,
                  width: crop.radius * 2,
                  height: crop.radius * 2,
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                }}
              />
              
              {/* Grid lines inside circle */}
              <div 
                className="absolute pointer-events-none"
                style={{
                  left: crop.x - crop.radius,
                  top: crop.y - crop.radius,
                  width: crop.radius * 2,
                  height: crop.radius * 2,
                  borderRadius: '50%',
                  overflow: 'hidden',
                }}
              >
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
              </div>
              
              {/* Resize handle */}
              <div 
                className="resize-handle absolute pointer-events-auto cursor-se-resize"
                style={{
                  left: crop.x + crop.radius - 6,
                  top: crop.y + crop.radius - 6,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'white',
                  border: '2px solid #3b82f6',
                  boxShadow: '0 0 0 2px rgba(59,130,246,0.3)',
                }}
              />
              
              {/* Center point */}
              <div 
                className="absolute pointer-events-none"
                style={{
                  left: crop.x - 2,
                  top: crop.y - 2,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.5)',
                }}
              />
            </>
          )}
        </div>
      </div>

      {isImageLoaded && (
        <>
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              Radius: {Math.round(crop.radius)}px
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => {
                  const newRadius = Math.min(crop.radius * 1.2, Math.min(crop.x, displaySize.width - crop.x, crop.y, displaySize.height - crop.y));
                  setCrop(prev => ({ ...prev, radius: newRadius }));
                }}
              >
                <Maximize2 className="h-3 w-3 mr-1" /> Zoom In
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => {
                  const newRadius = Math.max(20, crop.radius * 0.8);
                  setCrop(prev => ({ ...prev, radius: newRadius }));
                }}
              >
                <Minimize2 className="h-3 w-3 mr-1" /> Zoom Out
              </Button>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={applyCrop} className="h-8 text-xs gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Apply Crop
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Image Input ──────────────────────────────────────────────────────────────

const ImageInput = ({
  currentPreview,
  onChange,
}: {
  currentPreview: string;
  onChange: (val: string) => void;
}) => {
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [tempSrc, setTempSrc] = useState("");
  const [showCropper, setShowCropper] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [originalImage, setOriginalImage] = useState<string>(""); // Store original image for recrop
  const [lastCropPosition, setLastCropPosition] = useState<{ x: number; y: number; radius: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) { 
      toast.error("Please select an image file"); 
      return; 
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size should be less than 10MB");
      return;
    }
    
    setIsLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setOriginalImage(result); // Store original
      setTempSrc(result);
      setLastCropPosition(null); // Reset crop position for new image
      setShowCropper(true);
      setIsLoading(false);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleUrlApply = () => {
    setUrlError("");
    if (!urlInput.trim()) { 
      setUrlError("Please enter a URL"); 
      return; 
    }
    
    try { 
      new URL(urlInput); 
    } catch { 
      setUrlError("Invalid URL format"); 
      return; 
    }
    
    setIsLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL("image/jpeg", 0.92);
          setOriginalImage(base64); // Store original
          setTempSrc(base64);
          setLastCropPosition(null); // Reset crop position for new image
          setShowCropper(true);
        } else {
          setOriginalImage(urlInput);
          setTempSrc(urlInput);
          setLastCropPosition(null);
          setShowCropper(true);
        }
      } catch (error) {
        setOriginalImage(urlInput);
        setTempSrc(urlInput);
        setLastCropPosition(null);
        setShowCropper(true);
      }
      setIsLoading(false);
    };
    
    img.onerror = () => {
      setUrlError("Could not load image from this URL");
      setIsLoading(false);
    };
    img.src = urlInput;
  };

  const handleCropDone = (base64: string) => {
    onChange(base64);
    setShowCropper(false);
    setTempSrc("");
    setIsLoading(false);
    toast.success("Image cropped successfully!");
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempSrc("");
    setIsLoading(false);
  };

  const handleRecrop = () => {
    if (originalImage) {
      // Use the original full image for recrop
      setTempSrc(originalImage);
      setShowCropper(true);
    } else if (currentPreview) {
      // Fallback: if no original, use current preview
      setOriginalImage(currentPreview);
      setTempSrc(currentPreview);
      setShowCropper(true);
    }
  };

  // Store crop position when applying crop
  const handleCropApply = (base64: string) => {
    // We could store the crop position here if needed
    onChange(base64);
    setShowCropper(false);
    setTempSrc("");
    setIsLoading(false);
    toast.success("Image cropped successfully!");
  };

  if (showCropper && tempSrc) {
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-foreground">Crop Image</h4>
        <ImageCropper
          imageSrc={tempSrc}
          onCropComplete={handleCropApply}
          onCancel={handleCropCancel}
          initialCrop={lastCropPosition}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-border rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "url")}>
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="upload" className="text-xs gap-1.5 h-7">
            <Upload className="h-3 w-3" /> Upload File
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1.5 h-7">
            <Link className="h-3 w-3" /> Image URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3 space-y-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-6 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40"
          >
            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Click to upload an image</p>
            <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG, WEBP up to 10MB</p>
          </div>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="image/*" 
            onChange={handleFile} 
            className="hidden" 
          />
          <p className="text-xs text-muted-foreground">After upload you can crop the image to focus on the doctor's face.</p>
        </TabsContent>

        <TabsContent value="url" className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
              placeholder="https://example.com/doctor-photo.jpg"
              className="h-9 text-sm bg-muted/30 border-border/60 flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleUrlApply()}
            />
            <Button onClick={handleUrlApply} className="h-9 text-xs px-3" disabled={isLoading}>
              {isLoading ? "Loading..." : "Load"}
            </Button>
          </div>
          {urlError && <p className="text-xs text-red-500">{urlError}</p>}
          <p className="text-xs text-muted-foreground">Enter a direct link to the doctor's photo.</p>
        </TabsContent>
      </Tabs>

      {currentPreview && (
        <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border">
          <img
            src={currentPreview}
            alt="Preview"
            className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Profile image set</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {currentPreview.startsWith("data:") ? "Uploaded & cropped" : "URL image"}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 gap-1"
              onClick={handleRecrop}
            >
              <Pencil className="h-3 w-3" /> Recrop
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
              onClick={() => {
                onChange("");
                setOriginalImage(""); // Clear original when removing image
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Doctor Card ──────────────────────────────────────────────────────────────

const DoctorCard = ({ d, onEdit, onDelete }: { d: Doctor; onEdit: () => void; onDelete: () => void }) => {
  const days = d.available_days ? d.available_days.split(",").map((s) => s.trim()) : [];
  const allDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const initials = d.name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col">
      <div className="relative h-20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
        />
        <div className="absolute -bottom-8 left-4">
          {d.image_base64 ? (
            <img 
              src={d.image_base64} 
              alt={d.name} 
              className="h-16 w-16 rounded-full object-cover ring-4 ring-card shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-16 w-16 rounded-full ring-4 ring-card shadow-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">{initials}</span>
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1 shadow-sm">
          <p className="text-xs text-muted-foreground leading-none mb-0.5">Fee</p>
          <p className="text-sm font-bold text-primary leading-none">₹{d.fee.toLocaleString()}</p>
        </div>
      </div>

      <div className="pt-10 pb-4 px-4 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="font-semibold text-base text-foreground leading-tight">{d.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Stethoscope className="h-3 w-3 text-primary shrink-0" />
            <p className="text-xs text-primary font-medium">{d.specialization}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Availability</p>
          <div className="flex gap-1">
            {allDays.map((day) => {
              const active = days.includes(day);
              return (
                <div
                  key={day}
                  title={day}
                  className={`flex-1 text-center rounded py-1 text-[10px] font-semibold transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {day[0]}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{d.available_slots?.length || 0} time {d.available_slots?.length === 1 ? "slot" : "slots"} configured</span>
        </div>

        <div className="flex gap-2 mt-auto pt-3 border-t border-border">
          <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 gap-1.5 h-8 text-xs">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete} className="flex-1 gap-1.5 h-8 text-xs">
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [form, setForm] = useState({ name: "", specialization: "", fee: "", image_base64: "" });
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(defaultSchedule);

  const weekDays = [
    { key: "MON", label: "Monday" }, { key: "TUE", label: "Tuesday" },
    { key: "WED", label: "Wednesday" }, { key: "THU", label: "Thursday" },
    { key: "FRI", label: "Friday" }, { key: "SAT", label: "Saturday" },
    { key: "SUN", label: "Sunday" },
  ];

  const fetchDoctors = async () => {
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
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
    else { setLoading(false); toast.error("Not authenticated"); }
  }, [token]);

  useEffect(() => {
    let filtered = [...doctors];
    if (search.trim()) {
      const t = search.toLowerCase();
      filtered = filtered.filter((d) =>
        searchType === "name" ? d.name.toLowerCase().includes(t)
          : searchType === "specialization" ? d.specialization.toLowerCase().includes(t)
          : d.name.toLowerCase().includes(t) || d.specialization.toLowerCase().includes(t)
      );
    }
    if (selectedDate) {
      const dayKey = new Date(selectedDate).toLocaleString("en-US", { weekday: "short" }).toUpperCase();
      filtered = filtered.filter((d) => d.available_days?.includes(dayKey));
    }
    setFilteredDoctors(filtered);
  }, [search, searchType, doctors, selectedDate]);

  const handleEdit = (doctor: Doctor) => {
    setForm({ 
      name: doctor.name, 
      specialization: doctor.specialization, 
      fee: String(doctor.fee), 
      image_base64: doctor.image_base64 || "" 
    });
    setWeeklySchedule(apiFormatToSchedule(doctor.available_days, doctor.available_slots || []));
    setEditDoc(doctor);
    setShowModal(true);
  };

  const handleAdd = () => {
    setForm({ name: "", specialization: "", fee: "", image_base64: "" });
    setWeeklySchedule(defaultSchedule);
    setEditDoc(null);
    setShowModal(true);
  };

  const toggleDay = (k: string) =>
    setWeeklySchedule((p) => ({ ...p, [k]: { ...p[k as keyof WeeklySchedule], enabled: !p[k as keyof WeeklySchedule].enabled } }));

  const addTimeSlot = (k: string) =>
    setWeeklySchedule((p) => ({
      ...p, [k]: {
        ...p[k as keyof WeeklySchedule],
        timeSlots: [...p[k as keyof WeeklySchedule].timeSlots, { startHour: 9, startMinute: 0, startAmPm: "AM", endHour: 5, endMinute: 0, endAmPm: "PM" }],
      },
    }));

  const removeTimeSlot = (k: string, i: number) =>
    setWeeklySchedule((p) => ({ ...p, [k]: { ...p[k as keyof WeeklySchedule], timeSlots: p[k as keyof WeeklySchedule].timeSlots.filter((_, idx) => idx !== i) } }));

  const updateTimeSlot = (k: string, i: number, field: keyof TimeSlot, value: any) =>
    setWeeklySchedule((p) => ({
      ...p, [k]: {
        ...p[k as keyof WeeklySchedule],
        timeSlots: p[k as keyof WeeklySchedule].timeSlots.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
      },
    }));

  const applyToAllDays = () => {
    const enabled = Object.entries(weeklySchedule).filter(([, d]) => d.enabled);
    if (!enabled.length) { toast.error("No enabled days to apply to"); return; }
    const slots = JSON.parse(JSON.stringify(enabled[0][1].timeSlots));
    const next = { ...weeklySchedule };
    Object.keys(next).forEach((k) => {
      if (next[k as keyof WeeklySchedule].enabled) next[k as keyof WeeklySchedule].timeSlots = JSON.parse(JSON.stringify(slots));
    });
    setWeeklySchedule(next);
    toast.success("Time slots applied to all enabled days");
  };

  const getEnabledCount = () => Object.values(weeklySchedule).filter((d) => d.enabled).length;
  const getTotalTimeSlots = () => Object.values(weeklySchedule).reduce((t, d) => t + (d.enabled ? d.timeSlots.length : 0), 0);

  const handleSave = async () => {
    if (!form.name || !form.specialization) { toast.error("Name & specialization required"); return; }
    if (!form.fee || parseFloat(form.fee) <= 0) { toast.error("Valid consultation fee required"); return; }
    if (!Object.values(weeklySchedule).some((d) => d.enabled)) { toast.error("Please enable at least one day"); return; }
    setSaving(true);
    const { days, slots } = scheduleToAPIFormat(weeklySchedule);
    try {
      const payload = { 
        name: form.name, 
        specialization: form.specialization, 
        fee: parseFloat(form.fee), 
        available_days: days, 
        available_slots: slots, 
        image_base64: form.image_base64 
      };
      
      const res = await fetch(editDoc ? `${API}/${editDoc.doctor_id}` : API, {
        method: editDoc ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success(editDoc ? "Doctor updated!" : "Doctor added!");
      setShowModal(false);
      setEditDoc(null);
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
      const res = await fetch(`${API}/${deleteDoc.doctor_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Doctor deleted!");
      setDoctors((p) => p.filter((d) => d.doctor_id !== deleteDoc.doctor_id));
    } catch (err: any) {
      toast.error(err.message || "Delete error");
    } finally {
      setDeleteDoc(null);
    }
  };

  const uniqueSpecializations = [...new Set(doctors.map((d) => d.specialization))];
  const avgFee = doctors.length ? doctors.reduce((s, d) => s + d.fee, 0) / doctors.length : 0;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Doctors Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage doctor profiles, schedules, and availability</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="gap-1.5 h-8 text-xs">
          <Plus className="h-3 w-3" /> Add Doctor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: User, label: "Total Doctors", value: doctors.length, color: "blue" },
          { icon: Stethoscope, label: "Specializations", value: uniqueSpecializations.length, color: "purple" },
          { icon: CalendarDays, label: "Total Schedule Slots", value: doctors.reduce((s, d) => s + (d.available_slots?.length || 0), 0), color: "green" },
          { icon: Clock, label: "Avg Consultation Fee", value: `₹${avgFee.toFixed(0)}`, color: "yellow" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg bg-${color}-50 dark:bg-${color}-950/20`}>
                <Icon className={`h-3.5 w-3.5 text-${color}-600 dark:text-${color}-400`} />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
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
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Both</SelectItem>
              <SelectItem value="name">Name only</SelectItem>
              <SelectItem value="specialization">Specialization only</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={showDateFilter ? "default" : "outline"} size="sm" onClick={() => setShowDateFilter(!showDateFilter)} className="h-9 gap-1">
            <Calendar className="h-4 w-4" /> Date
          </Button>
        </div>
        {showDateFilter && (
          <div className="flex gap-2 items-center p-3 bg-muted/30 rounded-lg border border-border">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Filter by availability date:</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-8 text-sm flex-1" />
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate("")} className="h-8 px-2">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredDoctors.length === 0 ? (
        <div className="bg-card rounded-xl border border-border">
          <div className="py-12 text-center">
            <Stethoscope className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || selectedDate ? "No doctors match your search criteria" : "No doctors found"}
            </p>
            {(search || selectedDate) && <p className="text-xs text-muted-foreground mt-1">Try adjusting your search filters</p>}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDoctors.map((d) => (
            <DoctorCard key={d.doctor_id} d={d} onEdit={() => handleEdit(d)} onDelete={() => setDeleteDoc(d)} />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{editDoc ? "Edit Doctor" : "Add New Doctor"}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Fill in the doctor details and schedule</p>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Full Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. John Doe" className="h-9 text-sm bg-muted/30 border-border/60" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Specialization *</Label>
                  <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Cardiologist" className="h-9 text-sm bg-muted/30 border-border/60" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Consultation Fee (₹) *</Label>
                  <Input type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder="500" className="h-9 text-sm bg-muted/30 border-border/60" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Profile Image (Optional)</h3>
              <ImageInput
                currentPreview={form.image_base64}
                onChange={(val) => setForm({ ...form, image_base64: val })}
              />
            </div>

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
                  <Copy className="h-3 w-3" /> Apply to all days
                </Button>
              </div>
              <div className="space-y-2">
                {weekDays.map((day) => {
                  const schedule = weeklySchedule[day.key as keyof WeeklySchedule];
                  const isExpanded = expandedDay === day.key;
                  return (
                    <div key={day.key} className="border border-border rounded-lg overflow-hidden">
                      <div
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isExpanded ? "bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setExpandedDay(isExpanded ? null : day.key)}
                      >
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={schedule.enabled} onChange={(e) => { e.stopPropagation(); toggleDay(day.key); }} className="w-4 h-4 rounded" />
                          <span className={`text-sm font-medium ${schedule.enabled ? "text-foreground" : "text-muted-foreground"}`}>{day.label}</span>
                          {schedule.enabled && schedule.timeSlots.length > 0 && (
                            <span className="text-xs text-muted-foreground">{schedule.timeSlots.map(formatTimeSlotToString).join(", ")}</span>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                      {isExpanded && schedule.enabled && (
                        <div className="p-3 border-t border-border bg-muted/20 space-y-3">
                          {schedule.timeSlots.map((slot, si) => (
                            <div key={si} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                              <div className="flex-1">
                                <Label className="text-xs">Start Time</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input type="number" min="1" max="12" value={slot.startHour} onChange={(e) => updateTimeSlot(day.key, si, "startHour", parseInt(e.target.value) || 0)} className="h-8 text-center text-sm w-16" />
                                  <Input type="number" min="0" max="59" value={slot.startMinute} onChange={(e) => updateTimeSlot(day.key, si, "startMinute", parseInt(e.target.value) || 0)} className="h-8 text-center text-sm w-16" />
                                  <select value={slot.startAmPm} onChange={(e) => updateTimeSlot(day.key, si, "startAmPm", e.target.value)} className="px-2 py-1 border border-border rounded-md bg-background text-sm">
                                    <option>AM</option><option>PM</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">End Time</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input type="number" min="1" max="12" value={slot.endHour} onChange={(e) => updateTimeSlot(day.key, si, "endHour", parseInt(e.target.value) || 0)} className="h-8 text-center text-sm w-16" />
                                  <Input type="number" min="0" max="59" value={slot.endMinute} onChange={(e) => updateTimeSlot(day.key, si, "endMinute", parseInt(e.target.value) || 0)} className="h-8 text-center text-sm w-16" />
                                  <select value={slot.endAmPm} onChange={(e) => updateTimeSlot(day.key, si, "endAmPm", e.target.value)} className="px-2 py-1 border border-border rounded-md bg-background text-sm">
                                    <option>AM</option><option>PM</option>
                                  </select>
                                </div>
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => removeTimeSlot(day.key, si)} className="mt-5 text-red-500 hover:text-red-600 h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button size="sm" variant="outline" onClick={() => addTimeSlot(day.key)} className="w-full h-8 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Add Time Slot
                          </Button>
                        </div>
                      )}
                      {isExpanded && !schedule.enabled && (
                        <div className="p-3 border-t border-border bg-muted/20 text-center text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 inline mr-1" /> Enable this day to add time slots
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="h-8 text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1.5">
              {saving ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving...</> : editDoc ? "Update Doctor" : "Add Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deleteDoc?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteDoc(null)} className="h-8 text-xs">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="h-8 text-xs gap-1.5">
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorsManagement;