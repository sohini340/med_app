import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileImage,
  Clock,
  ShoppingCart,
  Pill,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/* ── Types matching backend exactly ── */
interface ScannedMedicine {
  name: string;
  dosage: string;
  frequency: string;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock";
  stockQuantity: number;
  price: number | null;
  medicineId: number | null;
}

interface ScanResult {
  medicines: ScannedMedicine[];
  summary: string;
}

// GET /customer/prescriptions returns:
// { id, image, summary, status, date, medicines: string[] }
interface PrescriptionHistory {
  id: number;
  image: string | null;
  summary: string;
  status: string;
  date: string | null;
  medicines: string[];
}

/* ─── Shared section header ─────────────────────────────── */
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

/* ─── Stock config ──────────────────────────────────────── */
const stockConfig = {
  "in-stock": {
    icon: CheckCircle2,
    label: "In Stock",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  "low-stock": {
    icon: AlertTriangle,
    label: "Low Stock",
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  "out-of-stock": {
    icon: XCircle,
    label: "Out of Stock",
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
  },
};

/* ─── Main component ────────────────────────────────────── */
const PrescriptionReader = () => {
  const { user, token } = useAuthStore();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<PrescriptionHistory[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [requestingMeds, setRequestingMeds] = useState<Set<string>>(new Set());

  /* ── Fetch history ── */
  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customer/prescriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Could not load prescription history");
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) fetchHistory();
  }, [user, token, fetchHistory]);

  /* ── File handling ── */
  const processFile = (f: File) => {
    if (!f.type.match(/^image\/(jpeg|png|webp|jpg)$/) && f.type !== "application/pdf") {
      toast.error("Please upload a JPG, PNG, or PDF");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const clearFile = () => {
    setFile(null);
    setPreview("");
    setResult(null);
  };

  /* ── Scan ── */
  const handleScan = async () => {
    if (!file || !token) return;
    setScanning(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE_URL}/customer/prescription/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Scan failed");
      }
      const data: ScanResult = await res.json();
      setResult(data);
      toast.success("Prescription scanned successfully!");
      // Refresh history so the new scan appears immediately
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setScanning(false);
    }
  };

  /* ── Request out-of-stock medicine ── */
  const handleRequestMedicine = async (med: ScannedMedicine) => {
    if (!token) return;
    setRequestingMeds((prev) => new Set(prev).add(med.name));
    try {
      // Backend expects { name, composition } – composition is optional
      const res = await fetch(`${API_BASE_URL}/customer/medicine-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: med.name,
          composition: med.dosage || null,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success(`${med.name} requested successfully`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRequestingMeds((prev) => {
        const s = new Set(prev);
        s.delete(med.name);
        return s;
      });
    }
  };

  /* ── Helpers ── */
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-3xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          Prescription Reader
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload a prescription to identify medicines and check stock availability
        </p>
      </div>

      {/* ── Upload + Results card ── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="p-5">
          <Section icon={Upload} title="Upload Prescription">
            {!file ? (
              <label
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 px-4 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-foreground bg-muted/60"
                    : "border-border hover:border-foreground/40 hover:bg-muted/40"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <FileImage className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Drop your prescription here
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    or{" "}
                    <span className="text-foreground underline underline-offset-2">
                      browse files
                    </span>{" "}
                    · JPG, PNG, PDF
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
              </label>
            ) : (
              <div className="flex items-start gap-4 p-3 bg-muted/50 rounded-xl border border-border">
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                  {preview && file.type !== "application/pdf" ? (
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileImage className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB · Ready to scan
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={handleScan}
                      disabled={scanning}
                      className="h-8 text-xs font-semibold rounded-lg px-3"
                    >
                      {scanning ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Scanning…</>
                      ) : (
                        <><ScanLine className="w-3.5 h-3.5 mr-1.5" /> Scan Prescription</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearFile}
                      disabled={scanning}
                      className="h-8 text-xs rounded-lg px-3"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Scan results */}
        {result && (
          <div className="border-t border-border p-5 space-y-4">
            <Section icon={Pill} title="Detected Medicines">
              {result.summary && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
                  {result.summary}
                </p>
              )}

              {result.medicines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No medicines detected in this prescription.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {result.medicines.map((med, i) => {
                    const status = med.stockStatus in stockConfig ? med.stockStatus : "out-of-stock";
                    const cfg = stockConfig[status as keyof typeof stockConfig];
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card"
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <Pill className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{med.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {med.dosage && (
                              <span className="text-xs text-muted-foreground">{med.dosage}</span>
                            )}
                            {med.frequency && (
                              <span className="text-xs text-muted-foreground">{med.frequency}</span>
                            )}
                          </div>
                          {med.price !== null && med.price !== undefined && (
                            <p className="text-xs font-medium text-foreground mt-1">
                              ₹{med.price}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                          {status === "out-of-stock" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 rounded-lg"
                              onClick={() => handleRequestMedicine(med)}
                              disabled={requestingMeds.has(med.name)}
                            >
                              {requestingMeds.has(med.name) ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <><ShoppingCart className="w-3 h-3 mr-1" /> Request</>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>

      {/* ── History card ── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5">
          <Section icon={Clock} title="Scan History">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                  <FileImage className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No scans yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your prescription history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrescription(p)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-all duration-150 text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {p.image ? (
                        <img
                          src={
                            typeof p.image === "string" && p.image.startsWith("data:")
                              ? p.image
                              : `data:image/jpeg;base64,${p.image}`
                          }
                          alt="rx"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileImage className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">
                        {p.summary || "Prescription scan"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {Array.isArray(p.medicines) && p.medicines.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {p.medicines.slice(0, 3).join(", ")}
                            {p.medicines.length > 3 && ` +${p.medicines.length - 3} more`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <StatusBadge status={p.status} />
                        {p.date && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDate(p.date)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── Detail modal ── */}
      <Dialog
        open={!!selectedPrescription}
        onOpenChange={() => setSelectedPrescription(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Prescription Details</DialogTitle>
          </DialogHeader>

          {selectedPrescription && (
            <div className="space-y-3 pt-1">
              {/* Thumbnail */}
              {selectedPrescription.image && (
                <div className="w-full h-40 rounded-xl overflow-hidden border border-border bg-muted">
                  <img
                    src={
                      typeof selectedPrescription.image === "string" &&
                      selectedPrescription.image.startsWith("data:")
                        ? selectedPrescription.image
                        : `data:image/jpeg;base64,${selectedPrescription.image}`
                    }
                    alt="prescription"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Summary */}
              {selectedPrescription.summary && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
                  {selectedPrescription.summary}
                </p>
              )}

              {/* Medicines list (string[] from history) */}
              {Array.isArray(selectedPrescription.medicines) &&
                selectedPrescription.medicines.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Medicines
                    </p>
                    {selectedPrescription.medicines.map((name, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-border text-sm"
                      >
                        <Pill className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium">{name}</span>
                      </div>
                    ))}
                  </div>
                )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <StatusBadge status={selectedPrescription.status} />
                {selectedPrescription.date && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(selectedPrescription.date)}
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrescriptionReader;