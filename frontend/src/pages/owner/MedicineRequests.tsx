import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { ClipboardList, Search, X, Package, Clock, CheckCircle, XCircle, Truck } from "lucide-react";

const API = "http://localhost:8000/owner/medicine-requests";

const statuses = ["pending", "in process", "ordered", "done", "rejected"];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400", icon: Clock },
  "in process": { label: "In Process", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", icon: Package },
  ordered: { label: "Ordered", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400", icon: Truck },
  done: { label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400", icon: XCircle },
};

type Request = {
  request_id: number;
  medicine_name: string;
  composition?: string;
  customer_name?: string;
  customer_phone?: string;
  requested_date: string;
  status: string;
};

const MedicineRequests = () => {
  const { token, user } = useAuthStore();

  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdates, setStatusUpdates] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // ---------------- LOAD ----------------
  const load = async () => {
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load requests");

      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
      setFilteredRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Error loading requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    else {
      setLoading(false);
      toast.error("Not authenticated");
    }
  }, [token]);

  // Filter requests based on search
  useEffect(() => {
    if (search.trim() === "") {
      setFilteredRequests(requests);
    } else {
      const searchTerm = search.toLowerCase();
      const filtered = requests.filter(req => 
        req.medicine_name.toLowerCase().includes(searchTerm) ||
        (req.composition && req.composition.toLowerCase().includes(searchTerm)) ||
        (req.customer_name && req.customer_name.toLowerCase().includes(searchTerm)) ||
        (req.customer_phone && req.customer_phone.includes(searchTerm))
      );
      setFilteredRequests(filtered);
    }
  }, [search, requests]);

  const clearSearch = () => setSearch("");

  // ---------------- SAVE ----------------
  const handleSave = async (reqId: number) => {
    const newStatus = statusUpdates[reqId];
    if (!newStatus) return;

    try {
      setSaving(reqId);

      const res = await fetch(`${API}/${reqId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          handled_by: user?.user_id,
        }),
      });

      if (!res.ok) throw new Error("Update failed");

      toast.success("Status updated!");

      setRequests((prev) =>
        prev.map((r) =>
          r.request_id === reqId ? { ...r, status: newStatus } : r
        )
      );

      setStatusUpdates((prev) => ({ ...prev, [reqId]: "" }));
    } catch (err: any) {
      toast.error(err.message || "Update error");
    } finally {
      setSaving(null);
    }
  };

  // Calculate stats
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === "pending").length;
  const inProcessRequests = requests.filter(r => r.status === "in process").length;
  const completedRequests = requests.filter(r => r.status === "done").length;
  const rejectedRequests = requests.filter(r => r.status === "rejected").length;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Medicine Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage customer medicine requests and track order status</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <ClipboardList className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{totalRequests}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Pending</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{pendingRequests}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">In Process</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{inProcessRequests}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Completed</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{completedRequests}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20">
              <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Rejected</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{rejectedRequests}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by medicine name, composition, customer name, or phone..."
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

      {/* Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No requests match your search" : "No medicine requests found"}
            </p>
            {search && (
              <p className="text-xs text-muted-foreground mt-1">
                Try searching by medicine name, customer name, or phone number
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Medicine</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Composition</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredRequests.map((r) => {
                  const statusInfo = statusConfig[r.status] || statusConfig.pending;
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <tr key={r.request_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-sm text-foreground">{r.medicine_name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {r.request_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {r.composition || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-foreground">
                        {r.customer_name || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {r.customer_phone || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(r.requested_date).toLocaleDateString("en-IN", { 
                          day: "numeric", 
                          month: "short", 
                          year: "numeric" 
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Select
                            value={statusUpdates[r.request_id] ?? r.status ?? "pending"}
                            onValueChange={(v) =>
                              setStatusUpdates({
                                ...statusUpdates,
                                [r.request_id]: v,
                              })
                            }
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statuses.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              saving === r.request_id ||
                              !statusUpdates[r.request_id] ||
                              statusUpdates[r.request_id] === r.status
                            }
                            onClick={() => handleSave(r.request_id)}
                            className="h-8 px-3 text-xs"
                          >
                            {saving === r.request_id ? (
                              <div className="flex items-center gap-1">
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Saving...
                              </div>
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
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

export default MedicineRequests;