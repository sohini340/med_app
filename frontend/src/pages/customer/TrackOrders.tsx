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
import { ShoppingCart, Package, Search, X, Send, ChevronRight, Loader2 } from "lucide-react";

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

const TrackOrders = () => {
  const { user, token } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOrder, setSearchOrder] = useState("");
  const [searchRequest, setSearchRequest] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [medicineName, setMedicineName] = useState("");
  const [composition, setComposition] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [ordersRes, requestsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/customer/orders`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/customer/medicine-requests`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!ordersRes.ok) throw new Error("Orders fetch failed");
        if (!requestsRes.ok) throw new Error("Requests fetch failed");

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

    fetchData();
  }, [token]);

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

      // Refresh preorders list
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

  // Safe search (prevents null crashes)
  const filteredOrders = orders.filter((o) =>
    o.id.toString().includes(searchOrder) ||
    o.items.some((i) => (i.name || "").toLowerCase().includes(searchOrder.toLowerCase()))
  );

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Track Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View your purchase history and manage medicine requests</p>
        </div>
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
              title={searchOrder ? "No matching orders" : "No orders yet"}
              description={searchOrder ? "Try a different search term" : "Your purchases will appear here"}
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

        {/* REQUESTS TAB */}
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

          {/* New Request Form */}
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