import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { motion } from 'framer-motion';
import { Pill, Calendar, FileText, MessageCircle, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: Pill, title: 'Smart Inventory', desc: 'Real-time medicine tracking with stock alerts and supplier management.' },
  { icon: Calendar, title: 'Doctor Consultations', desc: 'Book appointments with available doctors and track your visits.' },
  { icon: FileText, title: 'Prescription Reader', desc: 'AI-powered prescription scanning that checks medicine availability instantly.' },
  { icon: MessageCircle, title: 'Ask Mochi AI', desc: 'Your personal pharmacy assistant for medicine info and health questions.' },
  { icon: ShieldCheck, title: 'Secure & Reliable', desc: 'Role-based access with encrypted passwords and data protection.' },
  { icon: Clock, title: 'Preorder System', desc: 'Request unavailable medicines and track your preorder status in real-time.' },
];

const steps = [
  { num: '01', title: 'Sign Up', desc: 'Create your account as a customer or request employee access.' },
  { num: '02', title: 'Browse & Book', desc: 'Search medicines, book doctor appointments, or scan prescriptions.' },
  { num: '03', title: 'Get Assisted', desc: 'Use Mochi AI for guidance and track all your orders in one place.' },
];

const Landing = () => {

  // 🛡 SAFE AUTH STORE (THIS IS THE FIX)
  let isAuthenticated = false;
  let user: any = null;

  try {
    const auth = useAuthStore();
    isAuthenticated = auth?.isAuthenticated ?? false;
    user = auth?.user ?? null;
  } catch (err) {
    console.error("Auth store crashed:", err);
  }

  const dashPath =
    user?.role === 'owner'
      ? '/owner/overview'
      : user?.role === 'employee'
      ? '/employee/medicines'
      : '/customer/doctors';

  return (
    <div className="min-h-screen bg-background">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Pill className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-foreground">MedEase</span>
        </div>

        <div className="flex items-center gap-3">
          {/* 🛡 SAFE ThemeToggle */}
          {typeof ThemeToggle === "function" ? <ThemeToggle /> : null}

          {isAuthenticated ? (
            <Link to={dashPath}>
              <Button>Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost">Login</Button></Link>
              <Link to="/register"><Button>Get Started</Button></Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-6 py-24 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground mb-6 leading-tight">
              Your health, <span className="text-primary">streamlined.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              MedEase brings together pharmacy management, doctor consultations, AI prescription reading,
              and smart medicine tracking — all in one beautifully simple platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register-type">
                <Button size="lg" className="gap-2 px-8">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10" />
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
              Everything you need
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              A comprehensive pharmacy ecosystem designed for customers, employees, and owners.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
              How it works
            </h2>
            <p className="text-muted-foreground">Three simple steps to get started.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="text-4xl font-serif font-bold text-primary/30 mb-3">{s.num}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Pill className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-foreground">MedEase</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Smart Pharmacy & Doctor Consultation System
          </p>
        </div>
      </footer>

    </div>
  );
};

export default Landing;