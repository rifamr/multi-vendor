import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AuthRole, AuthUser } from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  login: (params: { email: string; password: string; role: AuthRole }) => Promise<AuthUser>;
  register: (params: { email: string; password: string; role: AuthRole; name?: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = (await res.json()) as { authenticated: boolean; user?: AuthUser };
      const nextUser = data.authenticated ? (data.user ?? null) : null;
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (params: { email: string; password: string; role: AuthRole }) => {
    const data = await fetchJson<{ ok: true; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (params: { email: string; password: string; role: AuthRole; name?: string }) => {
    const data = await fetchJson<{ ok: true; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(params),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refresh, login, register, logout }),
    [user, loading, refresh, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
