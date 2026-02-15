import { User, Mail, Phone, MapPin, Camera, Store, Briefcase, FileText } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { motion } from "framer-motion";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@apollo/client";
import { GET_CATEGORIES } from "@/graphql/serviceQueries";
import { useSearchParams } from "react-router-dom";

type VendorProfile = {
  businessName: string | null;
  serviceArea: string | null;
  experienceYears: number | null;
  isVerified: boolean | null;
  serviceCategoryId: number | null;
  licenseDocumentUrl: string | null;
  phoneNumber: string | null;
  description: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export default function VendorProfile() {
  const auth = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [experienceYears, setExperienceYears] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState("");

  const email = auth.user?.email ?? "";
  const { data: categoriesData } = useQuery(GET_CATEGORIES);
  const headerName = useMemo(() => (businessName.trim() ? businessName.trim() : ownerName?.trim() ? ownerName : email), [businessName, ownerName, email]);

  // Show setup message if coming from OAuth signup
  useEffect(() => {
    if (searchParams.get('setup') === 'true') {
      toast({
        title: "Welcome! Complete Your Profile",
        description: "Please fill in your vendor details to start offering services.",
        duration: 6000,
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    setOwnerName(auth.user?.name ?? "");
  }, [auth.user?.name]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetchJson<{ ok: true; profile: { vendor: VendorProfile | null } }>("/auth/profile");
        const v = res.profile.vendor;
        if (!mounted) return;
        setBusinessName(v?.businessName ?? "");
        setServiceArea(v?.serviceArea ?? "");
        setExperienceYears(v?.experienceYears != null ? String(v.experienceYears) : "");
        setPhoneNumber(v?.phoneNumber ?? "");
        setServiceCategoryId(v?.serviceCategoryId != null ? String(v.serviceCategoryId) : "");
        setDescription(v?.description ?? "");
        setLicenseDocumentUrl(v?.licenseDocumentUrl ?? "");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load profile";
        toast({ title: "Profile load failed", description: message, variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [toast]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetchJson<{ ok: true }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: ownerName,
          businessName,
          serviceArea,
          experienceYears: experienceYears.trim() ? Number(experienceYears) : null,
          phoneNumber,
          serviceCategoryId: serviceCategoryId ? Number(serviceCategoryId) : null,
          description,
          licenseDocumentUrl,
        }),
      });
      await auth.refresh();
      toast({ title: "Profile updated", description: "Vendor profile saved." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="vendor">
      <div className="max-w-2xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-secondary border border-border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <Store size={32} className="text-muted-foreground" />
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <Camera size={12} className="text-primary-foreground" />
              </button>
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">{headerName || "Vendor"}</h3>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading profile…" : "Vendor Profile"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Business Name</label>
              <div className="relative">
                <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Your business name"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Owner Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={email}
                  readOnly
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background/60 border border-border text-muted-foreground text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Service Type</label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={serviceCategoryId}
                  onChange={(e) => setServiceCategoryId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="">Select a category</option>
                  {categoriesData?.categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Service Area</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="City, State"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Experience (years)</label>
              <input
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. 5"
                min={0}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Business Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Tell customers about your business, services, and expertise..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">License/Certification URL</label>
              <div className="relative">
                <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={licenseDocumentUrl}
                  onChange={(e) => setLicenseDocumentUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://example.com/license.pdf"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Link to your license or certification document</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="mt-6 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
