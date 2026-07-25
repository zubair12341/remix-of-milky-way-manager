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

function withFallback<T>(promise: Promise<T>, fallback: T, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.error(`${label} timed out`);
      resolve(fallback);
    }, 4000);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const s = await withFallback(api().auth.session(), null, "Auth session check");
      setUser(s);
    } catch (error) {
      console.error("Auth session check failed", error);
      setUser(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSession();

    return () => { cancelled = true; };
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
