import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Search, X, UserCheck, UserX, Mail, Phone } from "lucide-react";

const API = "http://localhost:8000/owner/users";

type User = {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
};

const UserManagement = () => {
  const { token } = useAuthStore();

  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // ---------------- LOAD ----------------
  const load = async () => {
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load users");

      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
      setFilteredUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Error loading users");
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

  // Filter users based on search
  useEffect(() => {
    if (search.trim() === "") {
      setFilteredUsers(users);
    } else {
      const searchTerm = search.toLowerCase();
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.phone.includes(searchTerm)
      );
      setFilteredUsers(filtered);
    }
  }, [search, users]);

  const clearSearch = () => setSearch("");

  // ---------------- TOGGLE BLOCK ----------------
  const toggleBlock = async () => {
    if (!confirmUser) return;

    const newStatus =
      confirmUser.status === "blocked" ? "active" : "blocked";

    try {
      setSaving(true);

      const res = await fetch(
        `${API}/${confirmUser.user_id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error("Update failed");

      toast.success(`${confirmUser.name} is now ${newStatus}`);

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === confirmUser.user_id
            ? { ...u, status: newStatus }
            : u
        )
      );
    } catch (err: any) {
      toast.error(err.message || "Update error");
    } finally {
      setSaving(false);
      setConfirmUser(null);
    }
  };

  // Calculate stats
  const activeUsers = users.filter(u => u.status === "active").length;
  const blockedUsers = users.filter(u => u.status === "blocked").length;
  const adminUsers = users.filter(u => u.role === "owner").length;
  const employeeUsers = users.filter(u => u.role === "employee").length;
  const customerUsers = users.filter(u => u.role === "customer").length;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage user accounts and permissions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Users</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{users.length}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <UserCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Active</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{activeUsers}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20">
              <UserX className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Blocked</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{blockedUsers}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Mail className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Employees</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{employeeUsers}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <Phone className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Customers</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{customerUsers}</p>
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

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No users match your search" : "No users found"}
            </p>
            {search && (
              <p className="text-xs text-muted-foreground mt-1">
                Try searching by name, email, or phone number
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
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="font-medium text-sm text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {u.user_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {u.phone || <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${u.role === 'owner' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' :
                          u.role === 'employee' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        size="sm"
                        variant={u.status === "blocked" ? "default" : "destructive"}
                        onClick={() => setConfirmUser(u)}
                        className="h-7 px-3 text-xs"
                      >
                        {u.status === "blocked" ? "Unblock" : "Block"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG */}
      <Dialog open={!!confirmUser} onOpenChange={() => setConfirmUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {confirmUser?.status === "blocked" ? "Unblock User" : "Block User"}
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Are you sure you want to {confirmUser?.status === "blocked" ? "unblock" : "block"} 
            <span className="font-medium text-foreground"> {confirmUser?.name}</span>?
            {confirmUser?.status !== "blocked" && " They will not be able to access the system."}
          </p>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmUser(null)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              disabled={saving}
              variant={confirmUser?.status === "blocked" ? "default" : "destructive"}
              onClick={toggleBlock}
              className="h-8 text-xs gap-1.5"
            >
              {saving ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : (
                confirmUser?.status === "blocked" ? "Unblock User" : "Block User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;