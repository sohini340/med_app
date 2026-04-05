import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Menu, X, LogOut, Calendar, ShoppingCart, FileText, MessageCircle,
  Star, Pill, PlusCircle, ClipboardList, BarChart3, Users, UserCheck,
  Package, Stethoscope, MessageSquare, LayoutDashboard, Receipt,CalendarPlus,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const customerLinks = [
  { to: "/customer", label: "Overview", icon: LayoutDashboard },
  { to: "/customer/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/customer/book-appointment", label: "Book Appointment", icon: Calendar },
  { to: "/customer/appointments", label: "My Appointments", icon: ClipboardList },
  { to: "/customer/orders", label: "Track Orders", icon: ShoppingCart },
  { to: "/customer/prescription", label: "Prescription Reader", icon: FileText },
  { to: "/customer/ask-mochi", label: "Ask Mochi", icon: MessageCircle },
  { to: "/customer/feedback", label: "Feedback", icon: Star },
];

const employeeLinks = [
  { to: "/employee/medicines", label: "Medicine Search", icon: Pill },
  { to: "/employee/add-medicine", label: "Add Medicine", icon: PlusCircle },
  { to: "/employee/appointments", label: "Appointments", icon: Calendar },
  { to: "/employee/book-appointment", label: "Book Appointment", icon: CalendarPlus },
  { to: "/employee/preorders", label: "Preorder Requests", icon: ClipboardList },
  { to: "/employee/create-order", label: "Create Order", icon: Receipt },
  { to: "/employee/prescription", label: "Prescription Reader", icon: FileText },
  { to: "/employee/ask-mochi", label: "Ask Mochi", icon: MessageCircle },
];

const ownerLinks = [
  { to: "/owner/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/owner/sales", label: "Sales & Billing", icon: BarChart3 },
  { to: "/owner/inventory", label: "Inventory", icon: Package },
  { to: "/owner/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/owner/employee-requests", label: "Employee Requests", icon: UserCheck },
  { to: "/owner/users", label: "User Management", icon: Users },
  { to: "/owner/appointments", label: "Appointments", icon: Calendar },
  { to: "/owner/medicine-requests", label: "Medicine Requests", icon: ClipboardList },
  { to: "/owner/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/owner/prescription", label: "Prescription Reader", icon: FileText },
  { to: "/owner/ask-mochi", label: "Ask Mochi", icon: MessageCircle },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  if (!user) return null;

  const links =
    user.role === "owner"
      ? ownerLinks
      : user.role === "employee"
      ? employeeLinks
      : customerLinks;

  const handleLogout = () => {
    logout();
    localStorage.removeItem("medease-auth");
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-50 md:static flex flex-col h-full ${
          collapsed ? "w-18" : "w-56"
        } bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo - Arrow removed */}
        <div className="flex items-center px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-md bg-teal-500 flex items-center justify-center">
              <Pill className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-sm text-gray-900 dark:text-white">
                MedEase
              </span>
            )}
          </NavLink>
        </div>

        {/* User */}
        {!collapsed && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">
              {user.role}
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center">
              <span className="text-teal-600 dark:text-teal-400 text-xs font-medium">
                {user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/customer" || link.to === "/employee/medicines" || link.to === "/owner/overview"}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? link.label : ""}
              className={({ isActive }) =>
                `group flex items-center transition-all duration-200 rounded-lg ${
                  collapsed ? "justify-center" : "gap-3"
                } px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`
              }
            >
              <link.icon className={`h-4 w-4 ${collapsed ? "mx-auto" : ""}`} />
              {!collapsed && link.label}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {link.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-800">
          <Button
            variant="ghost"
            className={`w-full transition-all duration-200 ${
              collapsed ? "justify-center" : "justify-start gap-3"
            } text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20`}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Logout"}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-30">
          
          <div className="flex items-center gap-2">

            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Desktop collapse toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu className="h-4 w-4" />
            </Button>

          </div>

          <ThemeToggle />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
};