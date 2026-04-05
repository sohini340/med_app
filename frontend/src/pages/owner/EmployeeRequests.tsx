import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { UserCheck, Search, Users, CheckCircle, XCircle, Clock, Mail, Phone, Calendar as CalendarIcon } from "lucide-react";

const API = "http://localhost:8000/owner/employee-requests";

type Request = {
  request_id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  status: string;
};

const EmployeeRequests = () => {
  const { token } = useAuthStore();

  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // ---------------- LOAD ----------------
  const load = async () => {
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch requests");

      const data = await res.json();
      const requestsData = Array.isArray(data) ? data : [];
      setRequests(requestsData);
      setFilteredRequests(requestsData);
      
      // Calculate stats
      const pending = requestsData.filter((r: Request) => r.status === "pending").length;
      const approved = requestsData.filter((r: Request) => r.status === "approved").length;
      const rejected = requestsData.filter((r: Request) => r.status === "rejected").length;
      
      setStats({
        total: requestsData.length,
        pending,
        approved,
        rejected
      });
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
      const filtered = requests.filter(request => 
        request.name.toLowerCase().includes(searchTerm) ||
        request.email.toLowerCase().includes(searchTerm) ||
        request.phone.includes(searchTerm)
      );
      setFilteredRequests(filtered);
    }
  }, [search, requests]);

  const clearSearch = () => setSearch("");

  // ---------------- APPROVE ----------------
  const handleApprove = async (req: Request) => {
    try {
      setActionLoading(req.request_id);

      const res = await fetch(`${API}/${req.request_id}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Approval failed");

      toast.success(`${req.name} approved successfully!`);

      const updatedRequests = requests.map((r) =>
        r.request_id === req.request_id
          ? { ...r, status: "approved" }
          : r
      );
      setRequests(updatedRequests);
      
      // Update stats
      setStats({
        total: updatedRequests.length,
        pending: updatedRequests.filter(r => r.status === "pending").length,
        approved: updatedRequests.filter(r => r.status === "approved").length,
        rejected: updatedRequests.filter(r => r.status === "rejected").length
      });
    } catch (err: any) {
      toast.error(err.message || "Approval error");
    } finally {
      setActionLoading(null);
    }
  };

  // ---------------- REJECT ----------------
  const handleReject = async (req: Request) => {
    try {
      setActionLoading(req.request_id);

      const res = await fetch(`${API}/${req.request_id}/reject`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Reject failed");

      toast.success(`${req.name} rejected`);

      const updatedRequests = requests.map((r) =>
        r.request_id === req.request_id
          ? { ...r, status: "rejected" }
          : r
      );
      setRequests(updatedRequests);
      
      // Update stats
      setStats({
        total: updatedRequests.length,
        pending: updatedRequests.filter(r => r.status === "pending").length,
        approved: updatedRequests.filter(r => r.status === "approved").length,
        rejected: updatedRequests.filter(r => r.status === "rejected").length
      });
    } catch (err: any) {
      toast.error(err.message || "Reject error");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-3 w-3" />;
      case "rejected":
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Employee Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage employee signup requests</p>
        </div>
        {requests.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
            <Users className="h-3 w-3" />
            {requests.length} request{requests.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Requests</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{stats.total}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Pending</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{stats.pending}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Approved</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{stats.approved}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20">
              <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Rejected</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{stats.rejected}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone number..."
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

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <UserCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No requests match your search" : "No employee requests found"}
            </p>
            {search && (
              <p className="text-xs text-muted-foreground mt-1">
                Try a different name, email, or phone number
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Employee
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Contact
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((r) => (
                  <tr
                    key={r.request_id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">ID: {r.request_id}</p>
                      </div>
                    </td>
                    
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{r.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{r.phone}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{new Date(r.created_at).toLocaleDateString("en-IN", { 
                          day: "numeric", 
                          month: "short", 
                          year: "numeric" 
                        })}</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(r.status)}
                        <StatusBadge status={r.status} />
                      </div>
                    </td>

                    <td className="p-3">
                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={actionLoading === r.request_id}
                            onClick={() => handleApprove(r)}
                            className="h-7 text-xs gap-1"
                          >
                            {actionLoading === r.request_id ? (
                              <>
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Approve
                              </>
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoading === r.request_id}
                            onClick={() => handleReject(r)}
                            className="h-7 text-xs gap-1"
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {r.status !== "pending" && (
                        <span className="text-xs text-muted-foreground">
                          {r.status === "approved" ? "Processed" : "Closed"}
                        </span>
                      )}
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

export default EmployeeRequests;