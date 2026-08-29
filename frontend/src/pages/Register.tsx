import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Pill, 
  ShoppingBag, 
  UserCog, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  XCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { z } from 'zod';

// ============================================================================
// Constants & Validation
// ============================================================================

const PHONE_REGEX = /^[6-9]\d{9}$/;
const NAME_REGEX = /^[a-zA-Z\s\-']+$/;

const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(NAME_REGEX, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .email('Please enter a valid email address'),
  phone: z.string()
    .length(10, 'Phone number must be exactly 10 digits')
    .regex(PHONE_REGEX, 'Enter a valid 10-digit Indian mobile number (starts with 6-9)'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
});

type RegisterForm = z.infer<typeof registerSchema>;
type FormErrors = Partial<Record<keyof RegisterForm, string>>;

// ============================================================================
// Role Configuration
// ============================================================================

const ROLE_CONFIG = {
  customer: {
    icon: ShoppingBag,
    title: 'Customer Account',
    description: 'Access medications, consultations, and health records',
    buttonText: 'Create Account',
    loadingText: 'Creating account...',
    successRedirect: '/customer',
    requiresApproval: false,
  },
  employee: {
    icon: UserCog,
    title: 'Employee Account',
    description: 'Manage inventory, process orders, and track analytics',
    buttonText: 'Submit Registration Request',
    loadingText: 'Submitting request...',
    successRedirect: '/login',
    requiresApproval: true,
    successMessage: 'Registration request submitted successfully! Please wait for admin approval.',
  },
} as const;

type Role = keyof typeof ROLE_CONFIG;

// ============================================================================
// Custom Hooks
// ============================================================================

const useRoleFromUrl = (): Role | null => {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role') as Role | null;
  return roleParam && (roleParam === 'customer' || roleParam === 'employee') ? roleParam : null;
};

const useFormValidation = (form: RegisterForm) => {
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<keyof RegisterForm>>(new Set());

  const validateField = useCallback((field: keyof RegisterForm, value: string): boolean => {
    try {
      registerSchema.shape[field].parse(value);
      setErrors(prev => ({ ...prev, [field]: undefined }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [field]: error.errors[0].message }));
      }
      return false;
    }
  }, []);

  const validateAll = useCallback((): boolean => {
    const result = registerSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof RegisterForm] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }, [form]);

  const markTouched = useCallback((field: keyof RegisterForm) => {
    setTouched(prev => new Set(prev).add(field));
  }, []);

  const isFieldInvalid = useCallback((field: keyof RegisterForm): boolean => {
    return touched.has(field) && !!errors[field];
  }, [touched, errors]);

  return {
    errors,
    validateField,
    validateAll,
    markTouched,
    isFieldInvalid,
  };
};

// ============================================================================
// Subcomponents
// ============================================================================

interface FormFieldProps {
  id: keyof RegisterForm;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  error?: string;
  isInvalid?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  helperText?: React.ReactNode;
}

const FormField = ({
  id,
  label,
  type,
  placeholder,
  value,
  error,
  isInvalid,
  disabled,
  autoComplete,
  onChange,
  onBlur,
  leftElement,
  rightElement,
  helperText,
}: FormFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-slate-700 dark:text-slate-300 text-sm font-medium">
      {label} <span className="text-red-500">*</span>
    </Label>
    <div className="relative">
      {leftElement && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {leftElement}
        </div>
      )}
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${leftElement ? 'pl-16' : ''} ${rightElement ? 'pr-10' : ''} h-11 ${
          isInvalid ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700'
        }`}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
    {error && isInvalid && (
      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        {error}
      </p>
    )}
    {helperText && !error && (
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {helperText}
      </div>
    )}
  </div>
);

interface RoleCardProps {
  role: Role;
}

const RoleCard = ({ role }: RoleCardProps) => {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  
  return (
    <div className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 rounded-xl p-4 mb-6 border border-primary/20">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/20 text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-primary/80 font-medium uppercase tracking-wider">
            Registering as
          </p>
          <p className="font-semibold text-slate-900 dark:text-slate-50">
            {config.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
};

const PasswordRequirements = () => (
  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-1">
    <p>Password must contain:</p>
    <ul className="list-disc list-inside space-y-0.5 ml-1">
      <li>At least 8 characters</li>
      <li>One uppercase & one lowercase letter</li>
      <li>One number & one special character</li>
    </ul>
  </div>
);

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================================================
// Main Component
// ============================================================================

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const urlRole = useRoleFromUrl();
  
  // State declarations
  const [role, setRole] = useState<Role>(urlRole || 'customer');
  const [form, setForm] = useState<RegisterForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const { errors, validateField, validateAll, markTouched, isFieldInvalid } = useFormValidation(form);

  // Role validation effect
  useEffect(() => {
    if (urlRole) {
      setRole(urlRole);
    } else {
      navigate('/register-type');
    }
  }, [urlRole, navigate]);

  const handleInputChange = useCallback((field: keyof RegisterForm, value: string) => {
    // Auto-format phone number
    const processedValue = field === 'phone' 
      ? value.replace(/\D/g, '').slice(0, 10)
      : value;
    
    setForm(prev => ({ ...prev, [field]: processedValue }));
    validateField(field, processedValue);
    setApiError(null);
    setDebugInfo('');
  }, [validateField]);

  const handleBlur = useCallback((field: keyof RegisterForm) => {
    markTouched(field);
    validateField(field, form[field]);
  }, [markTouched, validateField, form]);

  const sendOtp = async (type: 'email' | 'phone') => {
    setApiError(null);
    setDebugInfo('');
    setOtpLoading(true);

    try {
      // Validation before sending OTP
      if (type === 'email' && !form.email) {
        throw new Error('Please enter your email address');
      }
      if (type === 'phone' && !form.phone) {
        throw new Error('Please enter your phone number');
      }

      // Validate the field before sending OTP
      const fieldToValidate = type === 'email' ? 'email' : 'phone';
      const isValid = validateField(fieldToValidate, form[fieldToValidate]);
      if (!isValid) {
        throw new Error(`Please enter a valid ${fieldToValidate}`);
      }

      const payload = type === 'email'
        ? {
            email: form.email,
            verification_type: 'email',
          }
        : {
            phone: `+91${form.phone}`,
            verification_type: 'phone',
          };

      console.log(`Sending OTP to ${type}:`, payload);
      setDebugInfo(`Sending OTP to ${type}...`);

      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);
      
      // Try to get response as text first for better error handling
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        // If response is not JSON, use text
        data = { detail: responseText || 'Server returned non-JSON response' };
      }

      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.detail || data.message || `Failed to send OTP (Status: ${response.status})`);
      }

      if (type === 'email') {
        setEmailOtpSent(true);
        setDebugInfo('OTP sent to your email successfully!');
      } else {
        setPhoneOtpSent(true);
        setDebugInfo('OTP sent to your phone successfully!');
      }

    } catch (error) {
      console.error('OTP send error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      setApiError(errorMessage);
      setDebugInfo(`Error: ${errorMessage}`);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async (type: 'email' | 'phone') => {
    setApiError(null);
    setDebugInfo('');
    setOtpLoading(true);

    try {
      const otp = type === 'email' ? emailOtp : phoneOtp;
      if (!otp || otp.length !== 6) {
        throw new Error('Please enter a valid 6-digit OTP');
      }

      const payload = type === 'email'
        ? {
            email: form.email,
            otp: otp,
            verification_type: 'email',
          }
        : {
            phone: `+91${form.phone}`,
            otp: otp,
            verification_type: 'phone',
          };

      console.log(`Verifying OTP for ${type}:`, payload);
      setDebugInfo(`Verifying OTP for ${type}...`);

      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { detail: responseText || 'Server returned non-JSON response' };
      }

      console.log('Verify response:', data);

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Invalid OTP');
      }

      if (type === 'email') {
        setEmailVerified(true);
        setDebugInfo('Email verified successfully!');
      } else {
        setPhoneVerified(true);
        setDebugInfo('Phone verified successfully!');
      }

    } catch (error) {
      console.error('OTP verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'OTP verification failed';
      setApiError(errorMessage);
      setDebugInfo(`Error: ${errorMessage}`);
    } finally {
      setOtpLoading(false);
    }
  };

  // Development helper to use test OTP
  const useTestOtp = (type: 'email' | 'phone') => {
    if (type === 'email') {
      setEmailOtp('123456');
    } else {
      setPhoneOtp('123456');
    }
    setDebugInfo(`Test OTP (123456) filled for ${type}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setDebugInfo('');
    
    // Mark all fields as touched
    (Object.keys(form) as Array<keyof RegisterForm>).forEach(markTouched);
    
    if (!validateAll()) return;

    // Both email and phone must be verified
    if (!emailVerified) {
      setApiError('Please verify your email address first.');
      return;
    }

    if (!phoneVerified) {
      setApiError('Please verify your phone number first.');
      return;
    }

    setLoading(true);
    
    try {
      const formattedPhone = `+91${form.phone}`;
      const config = ROLE_CONFIG[role];
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: formattedPhone, role }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Registration failed");
      }
      
      // Handle successful registration
      if (!config.requiresApproval) {
        const loginSuccess = await login(form.email, form.password);
        if (loginSuccess) {
          navigate(config.successRedirect);
        } else {
          throw new Error("Auto-login failed. Please log in manually.");
        }
      } else {
        navigate(config.successRedirect, { 
          state: { message: config.successMessage, type: "success" }
        });
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = useMemo(() => {
    return !Object.values(errors).some(Boolean) && 
           Object.values(form).every(Boolean);
  }, [errors, form]);

  const config = ROLE_CONFIG[role];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/register-type')}
              className="group flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all"
              aria-label="Go back to role selection"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-20 pb-8">
        <div className="max-w-md mx-auto">
          
          {/* Brand Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                <Pill className="h-6 w-6 text-white" />
              </div>
              <span className="font-serif text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-50 dark:to-slate-400 bg-clip-text text-transparent">
                MedEase
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">
              Create your account
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Join MedEase for seamless healthcare management
            </p>
          </div>

          {/* Role Card */}
          <RoleCard role={role} />

          {/* Error Alert */}
          {apiError && (
            <Alert variant="destructive" className="mb-6">
              <XCircle className="w-4 h-4" />
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          {/* Debug Info */}
          {debugInfo && (
            <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                {debugInfo}
              </AlertDescription>
            </Alert>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            
            <FormField
              id="name"
              label="Full Name"
              type="text"
              placeholder="Enter your full name"
              value={form.name}
              error={errors.name}
              isInvalid={isFieldInvalid('name')}
              disabled={loading}
              autoComplete="name"
              onChange={(value) => handleInputChange('name', value)}
              onBlur={() => handleBlur('name')}
            />

            <div className="space-y-2">
              <FormField
                id="email"
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                error={errors.email}
                isInvalid={isFieldInvalid('email')}
                disabled={loading || emailVerified}
                autoComplete="email"
                onChange={(value) => {
                  handleInputChange('email', value);
                  setEmailVerified(false);
                  setEmailOtpSent(false);
                  setEmailOtp('');
                }}
                onBlur={() => handleBlur('email')}
              />

              {!emailVerified && !emailOtpSent && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={!form.email || !!errors.email || otpLoading}
                    onClick={() => sendOtp('email')}
                  >
                    {otpLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Send Email OTP'
                    )}
                  </Button>
                  {import.meta.env.DEV && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => useTestOtp('email')}
                    >
                      Test OTP
                    </Button>
                  )}
                </div>
              )}

              {emailOtpSent && !emailVerified && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={emailOtp}
                      onChange={(e) =>
                        setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      maxLength={6}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      disabled={emailOtp.length !== 6 || otpLoading}
                      onClick={() => verifyOtp('email')}
                    >
                      {otpLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Verify'
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500"
                    onClick={() => {
                      setEmailOtpSent(false);
                      setEmailOtp('');
                    }}
                  >
                    Resend OTP
                  </Button>
                </div>
              )}

              {emailVerified && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Email verified
                </p>
              )}
            </div>

            <div className="space-y-2">
              <FormField
                id="phone"
                label="Phone Number"
                type="tel"
                placeholder="9876543210"
                value={form.phone}
                error={errors.phone}
                isInvalid={isFieldInvalid('phone')}
                disabled={loading || phoneVerified}
                autoComplete="tel"
                onChange={(value) => {
                  handleInputChange('phone', value);
                  setPhoneVerified(false);
                  setPhoneOtpSent(false);
                  setPhoneOtp('');
                }}
                onBlur={() => handleBlur('phone')}
                leftElement={
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span className="text-sm font-medium">+91</span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                  </div>
                }
                helperText="Enter 10-digit mobile number (starts with 6, 7, 8, or 9)"
              />

              {!phoneVerified && !phoneOtpSent && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={!form.phone || !!errors.phone || otpLoading}
                    onClick={() => sendOtp('phone')}
                  >
                    {otpLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Send Phone OTP'
                    )}
                  </Button>
                  {import.meta.env.DEV && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => useTestOtp('phone')}
                    >
                      Test OTP
                    </Button>
                  )}
                </div>
              )}

              {phoneOtpSent && !phoneVerified && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={phoneOtp}
                      onChange={(e) =>
                        setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      maxLength={6}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      disabled={phoneOtp.length !== 6 || otpLoading}
                      onClick={() => verifyOtp('phone')}
                    >
                      {otpLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Verify'
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500"
                    onClick={() => {
                      setPhoneOtpSent(false);
                      setPhoneOtp('');
                    }}
                  >
                    Resend OTP
                  </Button>
                </div>
              )}

              {phoneVerified && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Phone verified
                </p>
              )}
            </div>

            <FormField
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={form.password}
              error={errors.password}
              isInvalid={isFieldInvalid('password')}
              disabled={loading}
              autoComplete="new-password"
              onChange={(value) => handleInputChange('password', value)}
              onBlur={() => handleBlur('password')}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              helperText={<PasswordRequirements />}
            />

            <Button 
              type="submit" 
              className="w-full h-11 mt-2"
              disabled={
                loading ||
                !isFormValid ||
                !emailVerified ||
                !phoneVerified
              }
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {config.loadingText}
                </>
              ) : (
                config.buttonText
              )}
            </Button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-primary font-medium hover:underline underline-offset-4 transition-colors"
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

export default Register;