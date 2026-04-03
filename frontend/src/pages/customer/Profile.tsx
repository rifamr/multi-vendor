import { motion } from "framer-motion";
import { User, Mail, Camera, Phone } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";

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

export default function CustomerProfile() {
  const auth = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const email = auth.user?.email ?? "";
  const currentName = auth.user?.name ?? "";
  const currentPhone = auth.user?.phone ?? "";
  const displayName = useMemo(() => (currentName?.trim() ? currentName : email), [currentName, email]);

  useEffect(() => {
    setName(currentName ?? "");
    setPhone(currentPhone ?? "");
  }, [currentName, currentPhone]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetchJson<{ ok: true; user: { name: string | null } }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, phone }),
      });
      await auth.refresh();
      toast({ title: "Profile updated", description: `Saved as ${res.user.name ?? "(no name)"}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="customer">
      <div className="max-w-2xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-secondary border border-border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <User size={32} className="text-muted-foreground" />
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <Camera size={12} className="text-primary-foreground" />
              </button>
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">{displayName || "Customer"}</h3>
              <p className="text-sm text-muted-foreground">Account: {email || "—"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Your phone number"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
