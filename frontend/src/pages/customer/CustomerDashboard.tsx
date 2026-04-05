import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import {
  Calendar,
  ShoppingCart,
  Stethoscope,
  ArrowRight,
  Activity,
  Heart,
} from "lucide-react";

const CustomerDashboard = () => {
  const { user, token } = useAuthStore();

  const [ecgProgress, setEcgProgress] = useState(0);

  // ECG animation (smooth + continuous)
  useEffect(() => {
    let frame: number;

    const animate = () => {
      setEcgProgress((prev) => (prev >= 100 ? 0 : prev + 0.3));
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Action-based cards
  const actionCards = [
    {
      title: "Appointments",
      description: "View and manage your bookings",
      icon: Calendar,
      link: "/customer/appointments",
    },
    {
      title: "Doctors",
      description: "Browse available doctors",
      icon: Stethoscope,
      link: "/customer/doctors",
    },
    {
      title: "Orders",
      description: "Track and manage your orders",
      icon: ShoppingCart,
      link: "/customer/orders",
    },
    {
      title: "Medicine Requests",
      description: "Check requested medicines",
      icon: Activity,
      link: "/customer/orders",
    },
    {
      title: "Prescription Reader",
      description: "Scan and extract medicines",
      icon: Heart,
      link: "/customer/prescription",
    },
    {
      title: "Ask Mochi",
      description: "Chat with your AI assistant",
      icon: Activity,
      link: "/customer/ask-mochi",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      
      {/* ECG Sweep */}
      <div className="fixed inset-x-0 top-1/2 pointer-events-none">
        <svg
          className="w-full h-24"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="ecgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>

            <filter id="ecgGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d="
              M0 60 
              L100 60 
              L130 45 
              L150 75 
              L170 25 
              L190 60 
              L300 60 
              L330 85 
              L350 35 
              L370 60 
              L480 60 
              L510 30 
              L530 90 
              L550 60 
              L700 60 
              L730 50 
              L750 70 
              L770 35 
              L790 60 
              L900 60 
              L930 80 
              L950 40 
              L970 60 
              L1200 60
            "
            fill="none"
            stroke="url(#ecgGradient)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecgGlow)"
            strokeDasharray="260 940"
            strokeDashoffset={-ecgProgress * 12}
          />
        </svg>
      </div>

      {/* Main */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 md:py-12">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100">
            Hello, {user?.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            What would you like to do today?
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {actionCards.map((card, index) => {
            const Icon = card.icon;

            return (
              <div
                key={index}
                onClick={() => (window.location.href = card.link)}
                className="group border border-slate-200 dark:border-slate-800 rounded-xl p-6 
                hover:border-slate-300 dark:hover:border-slate-700 
                hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {card.title}
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      {card.description}
                    </p>

                    <div className="flex items-center gap-1 mt-4 text-sm font-medium text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition">
                      <span>Open</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;