import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Plus, Package, Filter, X, AlertCircle, CheckCircle, Calendar } from "lucide-react";

const API = "http://localhost:8000/employee/medicines";

type Medicine = {
  medicine_id: number;
  name: string;
  brand: string | null;
  composition: string | null;
  price: number;
  stock_quantity: number;
  expiry_date: string | null;
  supplier: string | null;
};

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type ExpiryFilter = "all" | "expiring_soon" | "expired" | "valid";

const AddMedicine = () => {
  const { token } = useAuthStore();

  const [form, setForm] = useState({
    name: "", brand: "", composition: "", price: "",
    stock_quantity: "", expiry_date: "", supplier: "",
  });

  const [loading, setLoading] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  const load = async (query = "") => {
    try {
      const res = await fetch(`${API}?search=${query}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const safe = Array.isArray(data) ? data : [];
      setMedicines(safe);
    } catch {
      toast.error("Failed to load medicines");
    }
  };

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, token]);

  // Apply filters
  useEffect(() => {
    let results = [...medicines];

    // Stock filter
    if (stockFilter !== "all") {
      results = results.filter((m) => {
        if (stockFilter === "in_stock") return m.stock_quantity > 10;
        if (stockFilter === "low_stock") return m.stock_quantity > 0 && m.stock_quantity <= 10;
        if (stockFilter === "out_of_stock") return m.stock_quantity === 0;
        return true;
      });
    }

    // Expiry filter
    if (expiryFilter !== "all") {
      results = results.filter((m) => {
        if (!m.expiry_date) return expiryFilter === "all";
        
        const today = new Date();
        const expiryDate = new Date(m.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (expiryFilter === "expiring_soon") return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
        if (expiryFilter === "expired") return daysUntilExpiry < 0;
        if (expiryFilter === "valid") return daysUntilExpiry >= 90;
        return true;
      });
    }

    setFilteredMedicines(results);
  }, [medicines, stockFilter, expiryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Medicine name required"); return; }
    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price) || 0,
          stock_quantity: parseInt(form.stock_quantity) || 0,
          expiry_date: form.expiry_date || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Medicine added");
      setForm({ name: "", brand: "", composition: "", price: "", stock_quantity: "", expiry_date: "", supplier: "" });
      load(search);
    } catch {
      toast.error("Failed to add");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this medicine?")) return;
    try {
      await fetch(`${API}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      toast.success("Deleted");
      load(search);
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleUpdate = async (updatedMedicine: Partial<Medicine>) => {
    if (!editingMedicine) return;
    try {
      const res = await fetch(`${API}/${editingMedicine.medicine_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updatedMedicine),
      });
      if (!res.ok) throw new Error();
      toast.success("Medicine updated");
      setEditingMedicine(null);
      load(search);
    } catch {
      toast.error("Update failed");
    }
  };

  const clearFilters = () => {
    setStockFilter("all");
    setExpiryFilter("all");
    setSearch("");
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 1000 * 60 * 60 * 24 * 90;
  };

  const isLowStock = (qty: number) => qty > 0 && qty <= 10;
  const hasActiveFilters = stockFilter !== "all" || expiryFilter !== "all";

  // Stats
  const inStockCount = medicines.filter(m => m.stock_quantity > 10).length;
  const lowStockCount = medicines.filter(m => m.stock_quantity > 0 && m.stock_quantity <= 10).length;
  const outOfStockCount = medicines.filter(m => m.stock_quantity === 0).length;
  const expiringSoonCount = medicines.filter(m => {
    if (!m.expiry_date) return false;
    const daysUntilExpiry = Math.ceil((new Date(m.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
  }).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Medicines</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your inventory</p>
        </div>
        {medicines.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
            <Package className="h-3 w-3" />
            {medicines.length} item{medicines.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[10px] text-muted-foreground uppercase">Total</span>
          </div>
          <p className="text-lg font-semibold text-foreground">{medicines.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            <span className="text-[10px] text-muted-foreground uppercase">In Stock</span>
          </div>
          <p className="text-lg font-semibold text-green-600">{inStockCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] text-muted-foreground uppercase">Low Stock</span>
          </div>
          <p className="text-lg font-semibold text-amber-600">{lowStockCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-[10px] text-muted-foreground uppercase">Out of Stock</span>
          </div>
          <p className="text-lg font-semibold text-red-600">{outOfStockCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-[10px] text-muted-foreground uppercase">Expiring Soon</span>
          </div>
          <p className="text-lg font-semibold text-orange-600">{expiringSoonCount}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Add Form */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Add Medicine</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Name <span className="text-primary">*</span></Label>
              <Input
                placeholder="e.g. Paracetamol 500mg"
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
                <Label className="text-xs text-muted-foreground">Composition</Label>
                <Input
                  placeholder="Active ingredients"
                  value={form.composition}
                  onChange={(e) => setForm({ ...form, composition: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Price (₹)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stock</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
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

            <Button type="submit" disabled={loading} size="sm" className="w-full gap-1.5 font-medium">
              {loading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" />
                  Add Medicine
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Medicine List with Filters */}
        <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col h-[520px]">
          <div className="px-4 py-3 border-b border-border space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search medicines..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm bg-muted/30 border-border/60"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Filter Button */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5 h-7 text-xs w-full"
              >
                <Filter className="h-3 w-3" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1 h-7 text-xs"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-muted/30 rounded-lg p-2 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Stock Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "all", label: "All", icon: Package },
                      { value: "in_stock", label: "In Stock", icon: CheckCircle },
                      { value: "low_stock", label: "Low Stock", icon: AlertCircle },
                      { value: "out_of_stock", label: "Out of Stock", icon: AlertCircle },
                    ].map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setStockFilter(filter.value as StockFilter)}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full transition-all ${
                          stockFilter === filter.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted border border-border"
                        }`}
                      >
                        <filter.icon className="h-2.5 w-2.5" />
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Expiry Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "all", label: "All", icon: Calendar },
                      { value: "valid", label: "Valid", icon: CheckCircle },
                      { value: "expiring_soon", label: "Expiring Soon", icon: AlertCircle },
                      { value: "expired", label: "Expired", icon: AlertCircle },
                    ].map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setExpiryFilter(filter.value as ExpiryFilter)}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full transition-all ${
                          expiryFilter === filter.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted border border-border"
                        }`}
                      >
                        <filter.icon className="h-2.5 w-2.5" />
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results count */}
            {filteredMedicines.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Showing {filteredMedicines.length} of {medicines.length} medicines
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredMedicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Package className="h-10 w-10 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters || search ? `No results for "${search}"` : "No medicines yet"}
                </p>
                {hasActiveFilters && (
                  <Button variant="link" size="sm" onClick={clearFilters} className="text-xs mt-1">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredMedicines.map((med) => (
                  <div key={med.medicine_id} className="px-4 py-3 hover:bg-muted/20 transition-colors group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground leading-tight">{med.name}</p>
                          {isLowStock(med.stock_quantity) && med.stock_quantity > 0 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Low stock
                            </span>
                          )}
                          {med.stock_quantity === 0 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              Out of stock
                            </span>
                          )}
                          {isExpiringSoon(med.expiry_date) && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              Exp. soon
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2.5 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="font-medium text-foreground">₹{med.price}</span>
                          <span>·</span>
                          <span>{med.stock_quantity} in stock</span>
                          {med.expiry_date && (
                            <>
                              <span>·</span>
                              <span>Exp {new Date(med.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </>
                          )}
                        </div>

                        {(med.brand || med.composition || med.supplier) && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                            {[med.brand, med.composition, med.supplier].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-0.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMedicine(med)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(med.medicine_id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingMedicine} onOpenChange={() => setEditingMedicine(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 rounded-2xl overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="text-base font-semibold">Edit Medicine</DialogTitle>
          </DialogHeader>

          {editingMedicine && (
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={editingMedicine.name}
                  onChange={(e) => setEditingMedicine({ ...editingMedicine, name: e.target.value })}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Brand</Label>
                  <Input
                    value={editingMedicine.brand || ""}
                    onChange={(e) => setEditingMedicine({ ...editingMedicine, brand: e.target.value })}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Composition</Label>
                  <Input
                    value={editingMedicine.composition || ""}
                    onChange={(e) => setEditingMedicine({ ...editingMedicine, composition: e.target.value })}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Price (₹)</Label>
                  <Input
                    type="number"
                    value={editingMedicine.price}
                    onChange={(e) => setEditingMedicine({ ...editingMedicine, price: parseFloat(e.target.value) })}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stock</Label>
                  <Input
                    type="number"
                    value={editingMedicine.stock_quantity}
                    onChange={(e) => setEditingMedicine({ ...editingMedicine, stock_quantity: parseInt(e.target.value) })}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                  <Input
                    type="date"
                    value={editingMedicine.expiry_date || ""}
                    onChange={(e) => setEditingMedicine({ ...editingMedicine, expiry_date: e.target.value })}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Supplier</Label>
                  <Input
                    value={editingMedicine.supplier || ""}
                    onChange={(e) => setEditingMedicine({ ...editingMedicine, supplier: e.target.value })}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleUpdate(editingMedicine)} size="sm" className="flex-1 font-medium">
                  Save Changes
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingMedicine(null)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddMedicine;