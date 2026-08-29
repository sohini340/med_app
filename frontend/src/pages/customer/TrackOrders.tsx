import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShoppingCart, Package, Search, X, Send, ChevronRight, Loader2, Filter } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type OrderItem = {
  id: number;
  name: string;
  brand: string;
  quantity: number;
  price: number;
};

type Order = {
  id: number;
  date: string | null;
  total: number;
  payment_method: string;
  payment_status: string;
  items: OrderItem[];
};

type Preorder = {
  id: number;
  medicine_name: string;
  composition: string | null;
  date: string;
  status: string;
};

type DateRange = "all" | "today" | "tomorrow" | "7days" | "15days" | "30days";

const TrackOrders = () => {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOrder, setSearchOrder] = useState("");
  const [searchRequest, setSearchRequest] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [medicineName, setMedicineName] = useState("");
  const [composition, setComposition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build URL with date params
      let ordersUrl = `${API_BASE_URL}/customer/orders`;
      const params = new URLSearchParams();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let fromDate: string | null = null;
      let toDate: string | null = null;

      switch (dateRange) {
        case "today":
          fromDate = today.toISOString().split("T")[0];
          toDate = tomorrow.toISOString().split("T")[0];
          break;
        case "tomorrow":
          const dayAfter = new Date(tomorrow);
          dayAfter.setDate(dayAfter.getDate() + 1);
          fromDate = tomorrow.toISOString().split("T")[0];
          toDate = dayAfter.toISOString().split("T")[0];
          break;
        case "7days":
          fromDate = today.toISOString().split("T")[0];
          const plus7 = new Date(today);
          plus7.setDate(plus7.getDate() + 7);
          toDate = plus7.toISOString().split("T")[0];
          break;
        case "15days":
          fromDate = today.toISOString().split("T")[0];
          const plus15 = new Date(today);
          plus15.setDate(plus15.getDate() + 15);
          toDate = plus15.toISOString().split("T")[0];
          break;
        case "30days":
          fromDate = today.toISOString().split("T")[0];
          const plus30 = new Date(today);
          plus30.setDate(plus30.getDate() + 30);
          toDate = plus30.toISOString().split("T")[0];
          break;
        default:
          break;
      }

      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (params.toString()) ordersUrl += `?${params.toString()}`;

      const [ordersRes, requestsRes] = await Promise.all([
        fetch(ordersUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/customer/medicine-requests`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!ordersRes.ok) {
        const errorText = await ordersRes.text();
        console.error("Orders error:", ordersRes.status, errorText);
        throw new Error(`Orders fetch failed (${ordersRes.status})`);
      }
      if (!requestsRes.ok) {
        const errorText = await requestsRes.text();
        console.error("Requests error:", requestsRes.status, errorText);
        throw new Error(`Requests fetch failed (${requestsRes.status})`);
      }

      const ordersData = await ordersRes.json();
      const requestsData = await requestsRes.json();

      if (!Array.isArray(ordersData)) throw new Error("Invalid orders format");
      if (!Array.isArray(requestsData)) throw new Error("Invalid requests format");

      setOrders(ordersData);
      setPreorders(requestsData);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load your data");
    } finally {
      setLoading(false);
    }
  };

  const handlePreorder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim()) {
      toast.error("Medicine name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customer/medicine-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: medicineName.trim(),
          composition: composition.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Request submitted successfully");
      setMedicineName("");
      setComposition("");

      // Refresh preorders
      const refreshRes = await fetch(`${API_BASE_URL}/customer/medicine-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setPreorders(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  // Client-side search by medicine name or order ID
  const filteredOrders = orders.filter((o) => {
    if (!searchOrder.trim()) return true;
    const searchLower = searchOrder.toLowerCase();
    return (
      o.id.toString().includes(searchLower) ||
      o.items.some((item) => item.name.toLowerCase().includes(searchLower))
    );
  });

  const filteredPreorders = preorders.filter((p) =>
    p.medicine_name.toLowerCase().includes(searchRequest.toLowerCase()) ||
    (p.composition || "").toLowerCase().includes(searchRequest.toLowerCase())
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
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

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Track Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View your purchase history and manage medicine requests</p>
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingCart className="h-4 w-4" /> Orders
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Package className="h-4 w-4" /> Requests
          </TabsTrigger>
        </TabsList>

        {/* ORDERS TAB */}
        <TabsContent value="orders" className="space-y-4">
          {/* Date filter buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Filter by:</span>
            {[
              { value: "all", label: "All" },
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
              { value: "7days", label: "7 days" },
              { value: "15days", label: "15 days" },
              { value: "30days", label: "30 days" },
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={dateRange === value ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange(value as DateRange)}
                className="h-8 px-3 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID or medicine name..."
              value={searchOrder}
              onChange={(e) => setSearchOrder(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/60"
            />
            {searchOrder && (
              <button onClick={() => setSearchOrder("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {filteredOrders.length === 0 ? (
            <EmptyState
              title={searchOrder ? "No matching orders" : "No orders in this period"}
              description={searchOrder ? "Try a different search term" : "Change the date filter or place an order"}
              icon={<ShoppingCart className="h-10 w-10 text-muted-foreground/30" />}
            />
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-all">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">#{order.id}</span>
                      <span className="text-sm font-medium text-foreground">₹{order.total.toFixed(2)}</span>
                      <StatusBadge status={order.payment_status} />
                      <span className="text-xs text-muted-foreground">{formatDate(order.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </span>
                      <ChevronRight className={`h-4 w-4 transition-transform ${expandedOrder === order.id ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                  {expandedOrder === order.id && (
                    <div className="border-t border-border p-4 space-y-2 bg-muted/10">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <div className="flex-1">
                            <span className="font-medium text-foreground">{item.name}</span>
                            {item.brand && <span className="text-xs text-muted-foreground ml-2">({item.brand})</span>}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">x{item.quantity}</span>
                            <span className="font-semibold text-foreground">₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 mt-2 border-t border-border/50 flex justify-end">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold text-primary">₹{order.total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* REQUESTS TAB (unchanged, already working) */}
        <TabsContent value="requests" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by medicine name or composition..."
              value={searchRequest}
              onChange={(e) => setSearchRequest(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/60"
            />
            {searchRequest && (
              <button onClick={() => setSearchRequest("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {filteredPreorders.length === 0 ? (
            <EmptyState
              title={searchRequest ? "No matching requests" : "No requests yet"}
              description={searchRequest ? "Try a different search term" : "Submit a request for medicines you need"}
              icon={<Package className="h-10 w-10 text-muted-foreground/30" />}
            />
          ) : (
            <div className="space-y-2">
              {filteredPreorders.map((req) => (
                <div key={req.id} className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{req.medicine_name}</p>
                    {req.composition && <p className="text-xs text-muted-foreground mt-0.5">{req.composition}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">Requested on {formatDate(req.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-5 mt-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">Request a Medicine</h3>
            <form onSubmit={handlePreorder} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Medicine Name *</Label>
                <Input
                  placeholder="e.g. Azithromycin 500mg"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Composition (Optional)</Label>
                <Input
                  placeholder="e.g. Azithromycin"
                  value={composition}
                  onChange={(e) => setComposition(e.target.value)}
                  className="h-9 text-sm bg-muted/30 border-border/60"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full gap-2" size="sm">
                {submitting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Submit Request</>
                )}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackOrders;