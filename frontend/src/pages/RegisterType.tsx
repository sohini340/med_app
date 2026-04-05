import { useNavigate, Link } from "react-router-dom";
import { User, Briefcase, Pill, ChevronRight, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";

const RegisterType = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<"customer" | "employee" | null>(null);

  const handleRoleSelection = (role: "customer" | "employee") => {
    setSelectedRole(role);
    setTimeout(() => {
      navigate(`/register?role=${role}`);
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-300 relative">
      {/* Slight Green Blur Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Navigation - No Green Aura */}
      <nav className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-3 backdrop-blur-md bg-white/80 dark:bg-[#030712]/80 border-b border-slate-200/50 dark:border-slate-800/50">
        <button 
          onClick={() => navigate("/")}
          className="group flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
          <span>Back</span>
        </button>
        <ThemeToggle />
      </nav>

      <div className="container mx-auto px-4 flex flex-col items-center justify-center min-h-screen relative z-10">
        <div className="max-w-4xl w-full py-8">
          
          {/* Minimal Brand with MedEase text - Pulled higher */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 transition-transform duration-300 hover:scale-105">
              <Pill className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2 tracking-wide">
              MedEase
            </h2>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight mb-2">
              Choose account type
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Select how you want to use MedEase
            </p>
          </div>

          {/* Side by Side Boxes */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Customer Card */}
            <button
              onClick={() => handleRoleSelection("customer")}
              className={`group flex flex-col items-center text-center p-6 rounded-xl border transition-all duration-300 ${
                selectedRole === "customer"
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg hover:-translate-y-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
              }`}
            >
              <div className={`p-3 rounded-xl transition-all duration-300 mb-3 ${
                selectedRole === "customer"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-md group-hover:shadow-primary/20 group-hover:scale-105"
              }`}>
                <User className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-50 group-hover:text-primary transition-colors duration-200 mb-1">
                  Customer
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  For patients and healthcare seekers
                </p>
              </div>
              <ChevronRight className={`w-4 h-4 mt-3 transition-all duration-300 ${
                selectedRole === "customer"
                  ? "text-primary translate-x-1"
                  : "text-slate-400 group-hover:translate-x-1 group-hover:text-primary opacity-0 group-hover:opacity-100"
              }`} />
            </button>

            {/* Employee Card */}
            <button
              onClick={() => handleRoleSelection("employee")}
              className={`group flex flex-col items-center text-center p-6 rounded-xl border transition-all duration-300 ${
                selectedRole === "employee"
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg hover:-translate-y-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
              }`}
            >
              <div className={`p-3 rounded-xl transition-all duration-300 mb-3 ${
                selectedRole === "employee"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-md group-hover:shadow-primary/20 group-hover:scale-105"
              }`}>
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-50 group-hover:text-primary transition-colors duration-200 mb-1">
                  Employee
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  For staff and administrators
                </p>
              </div>
              <ChevronRight className={`w-4 h-4 mt-3 transition-all duration-300 ${
                selectedRole === "employee"
                  ? "text-primary translate-x-1"
                  : "text-slate-400 group-hover:translate-x-1 group-hover:text-primary opacity-0 group-hover:opacity-100"
              }`} />
            </button>
          </div>

          {/* Sign in Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-slate-900 dark:text-slate-200 font-medium hover:text-primary transition-colors duration-200 hover:underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RegisterType;