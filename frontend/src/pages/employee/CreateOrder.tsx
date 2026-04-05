import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Receipt, Printer, Percent, Search, X, ShoppingCart } from 'lucide-react';

interface OrderItem {
  medicine_id: number;
  name: string;
  quantity: number;
  price: number;
  brand?: string;
}

interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
}

interface Medicine {
  medicine_id: number;
  name: string;
  brand: string;
  price: number;
  stock_quantity: number;
}

interface Order {
  order_id: number;
  customer_name: string;
  customer_phone: string;
  order_date: string;
  total_price: number;
  payment_status: string;
  subtotal?: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  payment_method?: string;
  order_items?: any[];
}

const API_BASE = "http://localhost:8000";
const API_MEDS = `${API_BASE}/employee/medicines`;
const API_ORDERS = `${API_BASE}/employee/orders`;

const CreateOrder = () => {
  const { user, token } = useAuthStore();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('offline');
  const [discount, setDiscount] = useState<Discount>({ type: 'percentage', value: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [selectedBill, setSelectedBill] = useState<Order | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [medSearch, setMedSearch] = useState('');
  const [showMedSearch, setShowMedSearch] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');

  useEffect(() => {
    loadMedicines();
    loadRecentOrders();
  }, []);

  useEffect(() => {
    // Filter orders when search term changes
    if (orderSearch.trim() === '') {
      setFilteredOrders(recentOrders);
    } else {
      const searchTerm = orderSearch.toLowerCase();
      const filtered = recentOrders.filter(order => 
        order.customer_name?.toLowerCase().includes(searchTerm) ||
        order.customer_phone?.includes(searchTerm) ||
        order.order_id.toString().includes(searchTerm)
      );
      setFilteredOrders(filtered);
    }
  }, [orderSearch, recentOrders]);

  const loadMedicines = async () => {
    try {
      const response = await fetch(API_MEDS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load medicines');
      const data = await response.json();
      setMedicines(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading medicines:', error);
      toast.error('Failed to load medicines');
      setMedicines([]);
    }
  };

  const loadRecentOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const response = await fetch(API_ORDERS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load orders');
      const data = await response.json();
      setRecentOrders(Array.isArray(data) ? data : []);
      setFilteredOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load recent orders');
      setRecentOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const discountAmount = discount.type === 'percentage' 
    ? (subtotal * discount.value) / 100 
    : Math.min(discount.value, subtotal);
  const total = subtotal - discountAmount;

  const addItem = (medId: string) => {
    const med = medicines.find((m) => String(m.medicine_id) === medId);
    if (!med) return;
    
    const existingItem = items.find((i) => i.medicine_id === med.medicine_id);
    if (existingItem) {
      const updatedItems = items.map(item => 
        item.medicine_id === med.medicine_id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      setItems(updatedItems);
      toast.success(`Added another ${med.name}`);
    } else {
      setItems([...items, { 
        medicine_id: med.medicine_id, 
        name: med.name, 
        brand: med.brand,
        quantity: 1, 
        price: med.price 
      }]);
      toast.success(`${med.name} added to order`);
    }
    setMedSearch('');
    setShowMedSearch(false);
  };

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems(items.map((it, i) => i === idx ? { ...it, quantity: qty } : it));
  };

  const removeItem = (idx: number) => {
    const item = items[idx];
    setItems(items.filter((_, i) => i !== idx));
    toast.info(`${item.name} removed from order`);
  };

  const handleDiscountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setDiscount({ ...discount, value: Math.max(0, numValue) });
  };

  const clearOrderSearch = () => {
    setOrderSearch('');
  };

  const handleSubmit = async () => {
    if (!customerName || !customerPhone) {
      toast.error('Please fill customer information');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item to the order');
      return;
    }
    
    setSubmitting(true);
    try {
      const paymentStatus = 'paid';

      const response = await fetch(API_ORDERS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          items: items.map(item => ({
            medicine_id: item.medicine_id,
            quantity: item.quantity,
            price: item.price,
          })),
          subtotal,
          discount_type: discount.type,
          discount_value: discount.value,
          discount_amount: discountAmount,
          total_price: total,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create order');
      }

      const data = await response.json();

      toast.success('Order created successfully!');
      
      const billData: Order = {
        order_id: data.order_id,
        customer_name: customerName,
        customer_phone: customerPhone,
        order_items: items.map(i => ({ 
          ...i, 
          medicines: { name: i.name, brand: i.brand } 
        })),
        subtotal,
        discount_amount: discountAmount,
        discount_type: discount.type,
        discount_value: discount.value,
        total_price: total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_date: new Date().toISOString(),
      };
      
      setSelectedBill(billData);
      
      setCustomerName('');
      setCustomerPhone('');
      setItems([]);
      setDiscount({ type: 'percentage', value: 0 });
      loadRecentOrders();
    } catch (err: any) {
      console.error('Order creation error:', err);
      toast.error(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMeds = medSearch 
    ? medicines.filter((m) => 
        m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
        (m.brand && m.brand.toLowerCase().includes(medSearch.toLowerCase()))
      ).slice(0, 10)
    : [];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create New Order</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create a new sales order for customer</p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
            <ShoppingCart className="h-3 w-3" />
            {items.length} item{items.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Order Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer Information Card */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Customer Information</h2>
              <p className="text-xs text-muted-foreground">Fields marked * are required</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="customerName" className="text-xs text-muted-foreground">
                    Full Name <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customerPhone" className="text-xs text-muted-foreground">
                    Phone Number <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="customerPhone"
                    placeholder="+91 00000 00000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-9 text-sm bg-muted/30 border-border/60"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Items Card */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-sm text-foreground">Order Items</h2>
                <p className="text-xs text-muted-foreground">Add medicines to the order</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMedSearch(true)}
                className="gap-1.5 h-8 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add Item
              </Button>
            </div>

            <div className="p-4">
              {/* Medicine Search Dialog */}
              <Dialog open={showMedSearch} onOpenChange={setShowMedSearch}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base font-semibold">Add Medicine to Order</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by medicine name or brand..."
                        value={medSearch}
                        onChange={(e) => setMedSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {filteredMeds.length > 0 ? (
                        filteredMeds.map((m) => (
                          <button
                            key={m.medicine_id}
                            onClick={() => addItem(String(m.medicine_id))}
                            className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm text-foreground">{m.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{m.brand} • Stock: {m.stock_quantity}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-sm text-primary">₹{m.price}</p>
                                <p className="text-xs text-muted-foreground">per unit</p>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : medSearch ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No medicines found matching "{medSearch}"
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Start typing to search for medicines
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Items Table */}
              {items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Item</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Price</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Quantity</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Total</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2">
                            <p className="font-medium text-sm text-foreground">{item.name}</p>
                            {item.brand && (
                              <p className="text-xs text-muted-foreground">{item.brand}</p>
                            )}
                          </td>
                          <td className="py-2 text-sm text-foreground">₹{item.price.toFixed(2)}</td>
                          <td className="py-2">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                              className="w-20 h-8 text-sm"
                            />
                          </td>
                          <td className="py-2 font-medium text-sm text-foreground">
                            ₹{(item.quantity * item.price).toFixed(2)}
                          </td>
                          <td className="py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(idx)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No items added</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Add Item" to start building this order</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Order Summary</h2>
            </div>

            <div className="p-4 space-y-4">
              {/* Payment Method */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('offline')}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      paymentMethod === 'offline'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/20'
                    }`}
                  >
                    Cash / Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      paymentMethod === 'online'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/20'
                    }`}
                  >
                    UPI / Online
                  </button>
                </div>
              </div>

              {/* Discount Section */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Discount</Label>
                <div className="flex gap-2">
                  <Select
                    value={discount.type}
                    onValueChange={(value: 'percentage' | 'fixed') => 
                      setDiscount({ ...discount, type: value, value: 0 })
                    }
                  >
                    <SelectTrigger className="w-28 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    {discount.type === 'percentage' && (
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    )}
                    <Input
                      type="number"
                      min={0}
                      max={discount.type === 'percentage' ? 100 : subtotal}
                      step={discount.type === 'percentage' ? 1 : 10}
                      value={discount.value || ''}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                      placeholder={discount.type === 'percentage' ? '0%' : '₹0'}
                      className={`h-9 text-sm ${discount.type === 'percentage' ? 'pr-7' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">₹{subtotal.toFixed(2)}</span>
                </div>
                {discount.value > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Discount {discount.type === 'percentage' ? `(${discount.value}%)` : ''}
                    </span>
                    <span className="text-green-600">-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">₹{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  className="w-full h-9 text-sm font-medium"
                  onClick={handleSubmit}
                  disabled={submitting || items.length === 0 || !customerName || !customerPhone}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Creating Order...
                    </div>
                  ) : (
                    'Create Order'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Section with Search */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm text-foreground">Recent Orders</h2>
              <p className="text-xs text-muted-foreground">Order history</p>
            </div>
            {filteredOrders.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
                <Receipt className="h-3 w-3" />
                {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone number, or order ID..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/60"
            />
            {orderSearch && (
              <button
                onClick={clearOrderSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        {loadingOrders ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-10 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {orderSearch ? "No orders match your search" : "No orders yet"}
            </p>
            {orderSearch && (
              <p className="text-xs text-muted-foreground mt-1">
                Try a different name or phone number
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Order ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground">#{order.order_id}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-sm text-foreground">{order.customer_name}</p>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {order.customer_phone}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(order.order_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-sm text-primary">
                      ₹{order.total_price?.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={order.payment_status} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedBill(order)}
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
        )}
      </div>

      {/* Bill Modal */}
      <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base font-semibold">
              <span>Invoice #{selectedBill?.order_id}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.print()}
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
                  <p className="font-medium text-gray-900">{selectedBill.customer_name}</p>
                  <p className="text-gray-600">Phone: {selectedBill.customer_phone}</p>
                </div>

                <table className="w-full mb-2 text-[11px]">
                  <thead>
                    <tr className="border-t border-b border-gray-200 bg-gray-50">
                      <th className="py-1 text-left font-medium text-gray-600">Item</th>
                      <th className="py-1 text-center font-medium text-gray-600">Qty</th>
                      <th className="py-1 text-right font-medium text-gray-600">Price</th>
                      <th className="py-1 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBill.order_items || []).map((item: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1">
                          <span className="font-medium text-gray-900">
                            {item.medicines?.name || item.name}
                          </span>
                        </td>
                        <td className="py-1 text-center text-gray-600">{item.quantity}</td>
                        <td className="py-1 text-right text-gray-600">₹{item.price.toFixed(2)}</td>
                        <td className="py-1 text-right font-medium text-gray-900">
                          ₹{(item.quantity * item.price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">₹{selectedBill.subtotal?.toFixed(2)}</span>
                  </div>
                  
                  {selectedBill.discount_amount && selectedBill.discount_amount > 0 && (
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-gray-600">Discount:</span>
                      <span className="text-green-600">-₹{selectedBill.discount_amount?.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200 mt-1">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-primary">₹{selectedBill.total_price?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-2 pt-1 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between">
                  <span className="capitalize">{selectedBill.payment_method}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium
                    ${selectedBill.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                      selectedBill.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-gray-100 text-gray-700'}`}>
                    {selectedBill.payment_status}
                  </span>
                </div>

                <p className="text-center text-[9px] text-gray-400 mt-2 pt-1 border-t border-gray-100">
                  Thank you for choosing MedEase
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <style jsx global>{`
        @media print {
          body *:not(#bill-content):not(#bill-content *) {
            visibility: hidden !important;
          }
          #bill-content {
            visibility: visible !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 9999;
          }
          #bill-content > div {
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            padding: 8px 6px !important;
            margin: 0 auto !important;
            max-width: 280px !important;
            font-size: 10px !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 0.2in 0.1in;
            size: 80mm auto;
          }
        }
      `}</style>
    </div>
  );
};

export default CreateOrder;