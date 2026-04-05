import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Pill, ClipboardList, Filter, X, Package, AlertCircle, CheckCircle, Calendar } from "lucide-react";

const API = "http://localhost:8000/employee/medicines";
const API_REQUEST = "http://localhost:8000/employee/medicine-requests";

type Medicine = {
  medicine_id: number;
  name: string;
  composition?: string;
  brand?: string;
  price: number;
  stock_quantity: number;
  expiry_date?: string;
};

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type ExpiryFilter = "all" | "expiring_soon" | "expired" | "valid";

const MedicineSearch = () => {
  const { token } = useAuthStore();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [filtered, setFiltered] = useState<Medicine[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const safe = Array.isArray(data) ? data : [];
      setMedicines(safe);
      setFiltered(safe);
    } catch {
      toast.error("Failed to load medicines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    else setLoading(false);
  }, [token]);

  // Apply all filters
  useEffect(() => {
    let results = [...medicines];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.composition?.toLowerCase().includes(q) ||
          m.brand?.toLowerCase().includes(q)
      );
    }

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

    setFiltered(results);
  }, [search, stockFilter, expiryFilter, medicines]);

  const handlePreorder = async (med: Medicine) => {
    setRequesting(med.medicine_id);
    try {
      const res = await fetch(API_REQUEST, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ medicine_name: med.name, composition: med.composition }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Preorder requested for ${med.name}`);
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setRequesting(null);
    }
  };

  const clearFilters = () => {
    setStockFilter("all");
    setExpiryFilter("all");
    setSearch("");
  };

  const getStockInfo = (qty: number) => {
    if (qty === 0) return { label: "Out of stock", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle };
    if (qty <= 10) return { label: "Low stock", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertCircle };
    return { label: "In stock", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle };
  };

  const getExpiryInfo = (date?: string) => {
    if (!date) return { label: "No expiry", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: Calendar };
    
    const today = new Date();
    const expiryDate = new Date(date);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return { label: "Expired", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle };
    if (daysUntilExpiry <= 90) return { label: "Expiring soon", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Calendar };
    return { label: "Valid", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle };
  };

  const hasActiveFilters = stockFilter !== "all" || expiryFilter !== "all" || search !== "";

  // Calculate stats
  const inStockCount = medicines.filter(m => m.stock_quantity > 10).length;
  const lowStockCount = medicines.filter(m => m.stock_quantity > 0 && m.stock_quantity <= 10).length;
  const outOfStockCount = medicines.filter(m => m.stock_quantity === 0).length;
  const expiringSoonCount = medicines.filter(m => {
    if (!m.expiry_date) return false;
    const daysUntilExpiry = Math.ceil((new Date(m.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
  }).length;

  if (loading) return <CardSkeleton count={8} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Medicine Search</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Browse and find medicines in inventory</p>
        </div>
        {medicines.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
            <Pill className="h-3 w-3" />
            {medicines.length} total medicines
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

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, brand, or composition..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/30 border-border/60"
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 h-9 text-xs"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-muted/30 rounded-lg p-3 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Stock Status</span>
              {stockFilter !== "all" && (
                <button
                  onClick={() => setStockFilter("all")}
                  className="text-[10px] text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All", icon: Package },
                { value: "in_stock", label: "In Stock", icon: CheckCircle },
                { value: "low_stock", label: "Low Stock", icon: AlertCircle },
                { value: "out_of_stock", label: "Out of Stock", icon: AlertCircle },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStockFilter(filter.value as StockFilter)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-all ${
                    stockFilter === filter.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted border border-border"
                  }`}
                >
                  <filter.icon className="h-3 w-3" />
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Expiry Status</span>
                {expiryFilter !== "all" && (
                  <button
                    onClick={() => setExpiryFilter("all")}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All", icon: Calendar },
                  { value: "valid", label: "Valid", icon: CheckCircle },
                  { value: "expiring_soon", label: "Expiring Soon", icon: AlertCircle },
                  { value: "expired", label: "Expired", icon: AlertCircle },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setExpiryFilter(filter.value as ExpiryFilter)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-all ${
                      expiryFilter === filter.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted border border-border"
                    }`}
                  >
                    <filter.icon className="h-3 w-3" />
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full h-7 text-xs gap-1"
              >
                <X className="h-3 w-3" />
                Clear All Filters
              </Button>
            )}
          </div>
        )}

        {/* Results count */}
        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} medicine{filtered.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border py-14 text-center">
          <Pill className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No medicines found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hasActiveFilters ? "Try adjusting your filters" : "No medicines in inventory yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((med) => {
            const stock = getStockInfo(med.stock_quantity);
            const expiry = getExpiryInfo(med.expiry_date);
            const StockIcon = stock.icon;
            const ExpiryIcon = expiry.icon;
            const alternatives = med.composition
              ? medicines.filter((m) => m.medicine_id !== med.medicine_id && m.composition === med.composition).slice(0, 3)
              : [];

            return (
              <div
                key={med.medicine_id}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                {/* Name + badges */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground leading-tight">{med.name}</p>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stock.cls}`}>
                        <StockIcon className="h-2.5 w-2.5" />
                        {stock.label}
                      </span>
                      {med.expiry_date && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${expiry.cls}`}>
                          <ExpiryIcon className="h-2.5 w-2.5" />
                          {expiry.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {(med.brand || med.composition) && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {[med.brand, med.composition].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                {/* Price + stock quantity */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-sm text-foreground">₹{med.price}</span>
                  <span>·</span>
                  <span>{med.stock_quantity} in stock</span>
                </div>

                {/* Alternatives */}
                {alternatives.length > 0 && (
                  <div className="pt-1 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Alternatives</p>
                    <div className="flex flex-wrap gap-1">
                      {alternatives.map((alt) => (
                        <span key={alt.medicine_id} className="text-[11px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                          {alt.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preorder button */}
                {med.stock_quantity === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-medium gap-1.5 mt-auto"
                    onClick={() => handlePreorder(med)}
                    disabled={requesting === med.medicine_id}
                  >
                    {requesting === med.medicine_id ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Requesting…
                      </>
                    ) : (
                      <>
                        <ClipboardList className="h-3 w-3" />
                        Request Preorder
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MedicineSearch;