import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Download, Printer, Receipt, Search, X, TrendingUp, ShoppingBag, DollarSign } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

const API = "http://localhost:8000/owner/sales";

type OrderItem = {
  name: string;
  quantity: number;
  price: number;
};

type Order = {
  order_id: number;
  order_date: string;
  customer_name?: string;
  customer_phone?: string;
  total_price: number;
  payment_method?: string;
  payment_status: string;
  items: OrderItem[];
  employee_name?: string;
};

const Sales = () => {
  const { token } = useAuthStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Order | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(API, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load sales data");

        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Sales load error:", err);
        toast.error(err.message || "Error loading sales");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      load();
    } else {
      setLoading(false);
      toast.error("Not authenticated");
    }
  }, [token]);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();

    return (
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_phone?.includes(q) ||
      o.order_id.toString().includes(q)
    );
  });

  const totalRevenue = filtered.reduce(
    (s, o) => s + (o.total_price || 0),
    0
  );

  const avgOrder = filtered.length
    ? totalRevenue / filtered.length
    : 0;

  const exportCSV = () => {
    const rows = filtered.map((o) => ({
      "Order ID": o.order_id,
      "Date": new Date(o.order_date).toLocaleString(),
      "Customer Name": o.customer_name || "-",
      "Customer Phone": o.customer_phone || "-",
      "Employee": o.employee_name || "-",
      "Total (₹)": o.total_price.toFixed(2),
      "Payment Method": o.payment_method || "-",
      "Payment Status": o.payment_status,
      "Items": o.items.map(i => `${i.name} (x${i.quantity})`).join(", ")
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.href = url;
    link.download = `sales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const printBill = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !selectedBill) return;

    const itemsHtml = selectedBill.items.map(item => `
      <tr>
        <td style="padding: 6px 0">${item.name}</td>
        <td style="text-align: center; padding: 6px 0">${item.quantity}</td>
        <td style="text-align: right; padding: 6px 0">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill #${selectedBill.order_id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 0; font-size: 18px; }
          .header p { margin: 4px 0; font-size: 11px; color: #666; }
          .bill-details { margin: 15px 0; font-size: 12px; }
          .bill-details p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
          th, td { padding: 6px 0; border-bottom: 1px solid #ddd; text-align: left; }
          th { font-weight: 600; }
          .total { text-align: right; margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd; }
          .total p { margin: 4px 0; font-size: 12px; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>MedEase Pharmacy</h2>
          <p>123 Healthcare Ave, Medical District</p>
          <p>Tel: +91 12345 67890</p>
        </div>
        
        <div class="bill-details">
          <p><strong>Bill #:</strong> ${selectedBill.order_id}</p>
          <p><strong>Date:</strong> ${new Date(selectedBill.order_date).toLocaleString()}</p>
          <p><strong>Customer:</strong> ${selectedBill.customer_name || 'Walk-in Customer'}</p>
          <p><strong>Phone:</strong> ${selectedBill.customer_phone || '-'}</p>
          <p><strong>Processed by:</strong> ${selectedBill.employee_name || 'System'}</p>
        </div>

        <table>
          <thead>
            <tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total">
          <p><strong>Total: ₹${selectedBill.total_price.toFixed(2)}</strong></p>
          <p>Payment: ${selectedBill.payment_method || 'offline'} (${selectedBill.payment_status})</p>
        </div>

        <div class="footer">
          <p>Thank you for shopping with MedEase!</p>
          <p>For queries, contact: support@medease.com</p>
        </div>

        <script>
          window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const clearSearch = () => setSearch("");

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View and manage all sales transactions</p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
          <Download className="h-3 w-3" />
          Export CSV
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer name, phone number, or order ID..."
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</span>
          </div>
          <p className="text-xl font-semibold text-foreground">₹{totalRevenue.toFixed(2)}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <ShoppingBag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Orders</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{filtered.length}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <TrendingUp className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Average Order</span>
          </div>
          <p className="text-xl font-semibold text-foreground">₹{avgOrder.toFixed(2)}</p>
        </div>
      </div>

      {/* Orders Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "No orders match your search" : "No orders found"}
            </p>
            {search && (
              <p className="text-xs text-muted-foreground mt-1">
                Try a different name or phone number
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
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Order ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Date & Time</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((o) => (
                  <tr key={o.order_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground">#{o.order_id}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm text-foreground">
                        {new Date(o.order_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.order_date).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-sm text-foreground">{o.customer_name || "Walk-in Customer"}</p>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {o.customer_phone || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-sm text-primary">
                      ₹{o.total_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={o.payment_status} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setSelectedBill(o)}
                        className="h-7 px-2 text-xs"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base font-semibold">
              <span>Invoice #{selectedBill?.order_id}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={printBill}
                className="gap-1 h-7 text-xs print:hidden"
              >
                <Printer className="h-3 w-3" />
                Print
              </Button>
            </DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-3" id="bill-content">
              <div className="bg-white rounded-lg p-4 print:p-0 text-sm">
                <div className="flex justify-between items-start border-b border-gray-200 pb-2 mb-2">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">MedEase</h2>
                    <p className="text-[10px] text-gray-500">Pharmacy</p>
                  </div>
                  <div className="text-right text-[10px] text-gray-500">
                    <p>{new Date(selectedBill.order_date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mb-2 text-[11px]">
                  <p className="font-medium text-gray-900">{selectedBill.customer_name || "Walk-in Customer"}</p>
                  <p className="text-gray-600">Phone: {selectedBill.customer_phone || "-"}</p>
                </div>

                <table className="w-full mb-2 text-[11px]">
                  <thead>
                    <tr className="border-t border-b border-gray-200 bg-gray-50">
                      <th className="py-1 text-left font-medium text-gray-600">Item</th>
                      <th className="py-1 text-center font-medium text-gray-600">Qty</th>
                      <th className="py-1 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBill.items || []).map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1">
                          <span className="font-medium text-gray-900">{item.name}</span>
                         </td>
                        <td className="py-1 text-center text-gray-600">{item.quantity}</td>
                        <td className="py-1 text-right font-medium text-gray-900">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-gray-900">₹{selectedBill.total_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span className="capitalize">{selectedBill.payment_method || "offline"}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium
                      ${selectedBill.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                        selectedBill.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-gray-100 text-gray-700'}`}>
                      {selectedBill.payment_status}
                    </span>
                  </div>
                </div>

                <p className="text-center text-[9px] text-gray-400 mt-2 pt-1 border-t border-gray-100">
                  Thank you for choosing MedEase
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;