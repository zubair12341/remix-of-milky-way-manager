import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/db";

type User = { id: number; username: string };

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const s = await api().auth.session();
    setUser(s);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const signIn: Ctx["signIn"] = async (username, password) => {
    const r = await api().auth.login(username, password);
    if (r.ok && r.user) setUser(r.user);
    return { error: r.ok ? null : (r.error ?? "Login failed") };
  };

  const signOut = async () => { await api().auth.logout(); setUser(null); };

  return <C.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</C.Provider>;
}

export function useAuth() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
