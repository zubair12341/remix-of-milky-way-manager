// Optional cloud pairing helpers. Local app keeps working with or without this.
import { supabase } from "@/integrations/supabase/client";

const KEY = "milkshop_cloud_pairing_v1";

export type CloudPairing = {
  user_id: string;
  email: string;
  business_id: string | null;
  business_name: string | null;
  paired_at: string;
};

export function getPairing(): CloudPairing | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function setPairing(p: CloudPairing | null) {
  if (typeof window === "undefined") return;
  if (p) localStorage.setItem(KEY, JSON.stringify(p));
  else localStorage.removeItem(KEY);
}

export async function cloudSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function cloudSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, user: data.user };
}

export async function cloudSignUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, user: data.user };
}

export async function cloudSignOut() {
  await supabase.auth.signOut();
  setPairing(null);
}

export async function listBusinesses() {
  const { data, error } = await supabase.from("businesses").select("id,name").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBusiness(name: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase.from("businesses").insert({ name, owner_id: uid }).select("id,name").single();
  if (error) throw error;
  // Auto-add as owner member (in case a trigger doesn't handle it)
  await supabase.from("business_members").insert({ business_id: data.id, user_id: uid, role: "owner" as any }).select().maybeSingle();
  return data;
}

export async function pairBusiness(businessId: string, businessName: string) {
  const { data: userData } = await supabase.auth.getUser();
  const u = userData.user;
  if (!u) throw new Error("Not signed in");
  setPairing({
    user_id: u.id,
    email: u.email ?? "",
    business_id: businessId,
    business_name: businessName,
    paired_at: new Date().toISOString(),
  });
}
