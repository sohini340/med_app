import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Package, Pill, Building, Calendar, Truck, AlertCircle, X } from "lucide-react";

const API = "http://localhost:8000/owner/medicines";

type Medicine = {
  medicine_id: number;
  name: string;
  composition?: string;
  brand?: string;
  price: number;
  stock_quantity: number;
  expiry_date?: string;
  supplier?: string;
};

const emptyForm = {
  name: "",
  composition: "",
  brand: "",
  price: "",
  stock_quantity: "",
  expiry_date: "",
  supplier: "",
};

const Inventory = () => {
  const { token } = useAuthStore();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [editMed, setEditMed] = useState<Medicine | null>(null);
  const [deleteMed, setDeleteMed] = useState<Medicine | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load medicines");

      const data = await res.json();
      setMedicines(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Error loading medicines");
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

  // Check if medicine is expiring soon (within 30 days)
  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    return expiry < today;
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: "Out of Stock", color: "red", icon: AlertCircle };
    if (quantity <= 10) return { label: "Low Stock", color: "yellow", icon: AlertCircle };
    return { label: "In Stock", color: "green", icon: Package };
  };

  const filtered = medicines.filter((m) =>
    `${m.name || ""} ${m.brand || ""} ${m.composition || ""} ${m.supplier || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalStock = medicines.reduce((sum, m) => sum + (m.stock_quantity || 0), 0);
  const lowStockItems = medicines.filter(m => m.stock_quantity <= 10 && m.stock_quantity > 0).length;
  const outOfStockItems = medicines.filter(m => m.stock_quantity === 0).length;
  const expiringSoonItems = medicines.filter(m => isExpiringSoon(m.expiry_date)).length;
  const expiredItems = medicines.filter(m => isExpired(m.expiry_date)).length;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name,
      composition: form.composition || null,
      brand: form.brand || null,
      supplier: form.supplier || null,
      price: parseFloat(form.price) || 0,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      expiry_date: form.expiry_date ? form.expiry_date : null,
    };

    try {
      const res = await fetch(
        editMed ? `${API}/${editMed.medicine_id}` : API,
        {
          method: editMed ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Save failed");

      toast.success(editMed ? "Medicine updated!" : "Medicine added!");

      setForm(emptyForm);
      setEditMed(null);
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMed) return;

    try {
      const res = await fetch(`${API}/${deleteMed.medicine_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Medicine deleted!");

      setMedicines((prev) =>
        prev.filter((m) => m.medicine_id !== deleteMed.medicine_id)
      );
    } catch (err: any) {
      toast.error(err.message || "Delete error");
    } finally {
      setDeleteMed(null);
    }
  };

  const openEdit = (m: Medicine) => {
    setForm({
      name: m.name || "",
      composition: m.composition || "",
      brand: m.brand || "",
      supplier: m.supplier || "",
      price: String(m.price),
      stock_quantity: String(m.stock_quantity),
      expiry_date: m.expiry_date || "",
    });

    setEditMed(m);
    setShowModal(true);
  };

  const clearSearch = () => setSearch("");

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage medicines, track stock levels, and monitor expiries</p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setEditMed(null);
            setShowModal(true);
          }}
          size="sm"
          className="gap-1.5 h-8 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add Medicine
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Items</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{medicines.length}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <Pill className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Stock</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{totalStock} units</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <AlertCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Low Stock</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{lowStockItems}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Out of Stock</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{outOfStockItems}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <Calendar className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Expiring Soon</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{expiringSoonItems}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, brand, composition, or supplier..."
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

      {/* Medicines Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No medicines match your search" : "No medicines found"}
            </p>
            {search && (
              <p className="text-xs text-muted-foreground mt-1">
                Try searching by name, brand, composition, or supplier
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
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Composition</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Expiry</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((m) => {
                  const stockStatus = getStockStatus(m.stock_quantity);
                  const expiringSoon = isExpiringSoon(m.expiry_date);
                  const expired = isExpired(m.expiry_date);
                  
                  return (
                    <tr key={m.medicine_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-sm text-foreground">{m.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {m.brand || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {m.composition || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {m.supplier || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-sm text-primary">
                        ₹{m.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                          ${stockStatus.color === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
                            stockStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400' :
                            'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'}`}>
                          <stockStatus.icon className="h-2.5 w-2.5" />
                          {m.stock_quantity} units
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {m.expiry_date ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                            ${expired ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
                              expiringSoon ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' :
                              'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'}`}>
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(m.expiry_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                       </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(m)}
                            className="h-7 w-7 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteMed(m)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editMed ? "Edit Medicine" : "Add New Medicine"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Fill in the medicine details below
            </p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Medicine Name <span className="text-primary">*</span>
              </Label>
              <Input
                placeholder="e.g. Amoxicillin 500mg"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9 text-sm bg-muted/30 border-border/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Brand</Label>
                <Input
                  placeholder="Brand name"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Supplier</Label>
                <Input
                  placeholder="Supplier name"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Composition</Label>
              <Input
                placeholder="Active ingredients (e.g., Amoxicillin 500mg)"
                value={form.composition}
                onChange={(e) => setForm({ ...form, composition: e.target.value })}
                className="h-9 text-sm bg-muted/30 border-border/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stock Quantity</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Expiry Date</Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                className="h-9 text-sm bg-muted/30 border-border/60"
              />
              <p className="text-[10px] text-muted-foreground">
                Medicines expiring within 30 days will be highlighted
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="h-8 text-xs gap-1.5"
            >
              {saving ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                editMed ? "Update Medicine" : "Add Medicine"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteMed} onOpenChange={() => setDeleteMed(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deleteMed?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteMed(null)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="h-8 text-xs gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;