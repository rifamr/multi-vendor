import { motion } from "framer-motion";
import { Mail, Lock, Chrome, User, Store, Phone, FileText, Briefcase, MapPin } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { useQuery } from "@apollo/client";
import { GET_CATEGORIES } from "@/graphql/serviceQueries";
import {
  getSelectedRole,
  roleToDashboardPath,
  setSelectedRole,
  type AuthRole,
} from "@/lib/auth";

type AuthMode = "signin" | "signup";

function useAuthMode(): AuthMode {
  const location = useLocation();
  return useMemo(() => {
    const mode = new URLSearchParams(location.search).get("mode");
    return mode === "signup" ? "signup" : "signin";
  }, [location.search]);
}

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();
  const mode = useAuthMode();

  const [signupStep, setSignupStep] = useState(1); // Multi-step signup
  const [role, setRole] = useState<AuthRole | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Vendor-specific fields
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [description, setDescription] = useState("");
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState("");

  const { data: categoriesData } = useQuery(GET_CATEGORIES);

  // Calculate total steps based on role
  const totalSteps = mode === "signup" ? (role === "vendor" ? 3 : 2) : 1;

  useEffect(() => {
    if (!auth.loading && auth.user) {
      navigate(roleToDashboardPath(auth.user.role), { replace: true });
      return;
    }
    const savedRole = getSelectedRole();
    if (savedRole) setRole(savedRole);
  }, [auth.loading, auth.user, navigate]);

  const getStepTitle = () => {
    if (mode === "signin") return "Welcome Back";
    if (signupStep === 1) return "Choose Your Role";
    if (signupStep === 2) return "Account Details";
    if (signupStep === 3) return "Business Information";
    return "Create Account";
  };

  const getStepSubtitle = () => {
    if (mode === "signin") return "Sign in to your account";
    if (signupStep === 1) return "Select how you'll use the platform";
    if (signupStep === 2) return "Create your account credentials";
    if (signupStep === 3) return "Tell us about your business";
    return "Sign up to start booking services";
  };

  function pickRole(nextRole: AuthRole) {
    setRole(nextRole);
    setSelectedRole(nextRole);
  }

  function handleNext() {
    // Validate current step before proceeding
    if (mode !== "signup") return;

    if (signupStep === 1) {
      if (!role) {
        toast({ title: "Role required", description: "Please select Customer or Vendor.", variant: "destructive" });
        return;
      }
      setSignupStep(2);
    } else if (signupStep === 2) {
      if (!email.trim()) {
        toast({ title: "Email required", description: "Please enter your email.", variant: "destructive" });
        return;
      }
      if (!password || password.length < 6) {
        toast({ title: "Password required", description: "Password must be at least 6 characters.", variant: "destructive" });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: "Passwords don't match", description: "Please confirm your password.", variant: "destructive" });
        return;
      }
      
      // If customer, submit now; if vendor, go to step 3
      if (role === "customer") {
        handleSubmit();
      } else {
        setSignupStep(3);
      }
    }
  }

  function handleBack() {
    if (signupStep > 1) {
      setSignupStep(signupStep - 1);
    }
  }

  function ensureRoleSelected(): AuthRole {
    if (role) return role;
    toast({
      title: "Choose a role",
      description: "Select Customer or Vendor before continuing.",
      variant: "destructive",
    });
    throw new Error("Role not selected");
  }

  async function handleSubmit() {
    const selectedRole = ensureRoleSelected();

    if (!email.trim()) {
      toast({ title: "Email required", description: "Enter your email to continue.", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Password required", description: "Enter your password to continue.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (password.length < 6) {
          toast({ title: "Weak password", description: "Use at least 6 characters.", variant: "destructive" });
          return;
        }
        if (password !== confirmPassword) {
          toast({ title: "Passwords don't match", description: "Re-check and try again.", variant: "destructive" });
          return;
        }

        // Vendor-specific validation
        if (selectedRole === "vendor") {
          if (!businessName.trim()) {
            toast({ title: "Business name required", description: "Enter your business name.", variant: "destructive" });
            return;
          }
          if (!phoneNumber.trim()) {
            toast({ title: "Phone number required", description: "Enter your contact number.", variant: "destructive" });
            return;
          }
          if (!serviceCategoryId) {
            toast({ title: "Service type required", description: "Select your service category.", variant: "destructive" });
            return;
          }
        }

        const requestBody: any = {
          email,
          password,
          role: selectedRole,
          name: name.trim() ? name.trim() : undefined,
        };

        // Add vendor profile data if registering as vendor
        if (selectedRole === "vendor") {
          requestBody.vendorProfile = {
            businessName: businessName.trim(),
            phoneNumber: phoneNumber.trim(),
            serviceArea: serviceArea.trim() || undefined,
            serviceCategoryId: serviceCategoryId ? Number(serviceCategoryId) : undefined,
            experienceYears: experienceYears ? Number(experienceYears) : undefined,
            description: description.trim() || undefined,
            licenseDocumentUrl: licenseDocumentUrl.trim() || undefined,
          };
        }

        const response = await fetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const json = await response.json();
          throw new Error(json.error ?? "Signup failed");
        }

        const json = await response.json();
        auth.refresh();
        toast({ title: "Account created!", description: "Welcome aboard 🎉" });
        navigate(roleToDashboardPath(selectedRole), { replace: true });
      } else {
        const response = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, role: selectedRole }),
        });

        if (!response.ok) {
          const json = await response.json();
          throw new Error(json.error ?? "Login failed");
        }

        auth.refresh();
        toast({ title: "Welcome back!", description: "Signed in successfully." });
        navigate(roleToDashboardPath(selectedRole), { replace: true });
      }
    } catch (err: any) {
      toast({
        title: mode === "signup" ? "Signup failed" : "Login failed",
        description: err?.message ?? "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSocial(provider: "google" | "facebook") {
    try {
      const selectedRole = ensureRoleSelected();

      if (provider === "google") {
        window.location.href = `/auth/google?role=${selectedRole}`;
      } else {
        toast({
          title: "Coming soon",
          description: "We'll wire Facebook OAuth after Google is working.",
        });
      }
    } catch {
      // role toast already shown
    }
  }

  return (
    <div className="min-h-screen gradient-dark-radial flex items-center justify-center px-4">
      <div className="gradient-glow absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-card rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock size={24} className="text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{getStepTitle()}</h1>
            <p className="text-sm text-muted-foreground mt-1">{getStepSubtitle()}</p>
            
            {/* Progress indicator for signup */}
            {mode === "signup" && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {Array.from({ length: totalSteps }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx + 1 === signupStep
                        ? "w-8 bg-primary"
                        : idx + 1 < signupStep
                        ? "w-6 bg-primary/60"
                        : "w-4 bg-border"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Step 1: Role Selection (signup only) */}
          {mode === "signup" && signupStep === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Select Your Role</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => pickRole("customer")}
                    className={`flex flex-col items-center justify-center gap-3 py-6 rounded-xl border text-sm font-medium transition-all ${
                      role === "customer"
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                        : "border-border text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <User size={28} />
                    <div>
                      <div className="font-semibold">Customer</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Book services</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => pickRole("vendor")}
                    className={`flex flex-col items-center justify-center gap-3 py-6 rounded-xl border text-sm font-medium transition-all ${
                      role === "vendor"
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                        : "border-border text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Store size={28} />
                    <div>
                      <div className="font-semibold">Vendor</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Offer services</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Social login options for signup */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-background/40 text-xs text-muted-foreground rounded-full">or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocial("google")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Chrome size={16} /> Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocial("facebook")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Account credentials (signup) OR Sign in form */}
          {((mode === "signup" && signupStep === 2) || mode === "signin") && (
            <div className="space-y-4 mb-6">
              {mode === "signin" && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Continue as</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => pickRole("customer")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        role === "customer"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <User size={16} /> Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => pickRole("vendor")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        role === "vendor"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <Store size={16} /> Vendor
                    </button>
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {mode === "signup" && (
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Vendor business info (signup only, vendor only) */}
          {mode === "signup" && signupStep === 3 && role === "vendor" && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Business Name *</label>
                <div className="relative">
                  <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Your business name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Phone Number *</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Service Type *</label>
                <select
                  value={serviceCategoryId}
                  onChange={(e) => setServiceCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a category</option>
                  {categoriesData?.categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Service Area</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="e.g., Downtown, Bay Area"
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Years of Experience</label>
                <input
                  type="number"
                  placeholder="e.g., 5"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Description</label>
                <textarea
                  placeholder="Tell customers about your business..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">License/Certification URL</label>
                <div className="relative">
                  <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder="https://example.com/license.pdf"
                    value={licenseDocumentUrl}
                    onChange={(e) => setLicenseDocumentUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/40 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Optional: Link to your license or certification document</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            {mode === "signup" && signupStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="px-6 py-3 rounded-2xl border border-border text-foreground font-semibold text-sm hover:bg-secondary/50 transition-colors"
              >
                Back
              </button>
            )}
            
            {mode === "signin" || (mode === "signup" && signupStep === 2 && role === "customer") || (mode === "signup" && signupStep === 3) ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
              >
                {submitting ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
              >
                Next
              </button>
            )}
          </div>

          {mode === "signin" && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-background/40 text-xs text-muted-foreground rounded-full">or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => handleSocial("google")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Chrome size={16} /> Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocial("facebook")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
              </div>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <Link to="/login?mode=signup" className="text-primary font-medium hover:underline">Sign up</Link>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
