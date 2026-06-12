import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLang();
  const [form, setForm] = useState({ shop_name: "", shop_address: "", shop_phone: "", shop_logo_url: "", full_name: "" });
  const [loading, setLoading] = useState(true);
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) setForm({
        shop_name: data.shop_name ?? "",
        shop_address: data.shop_address ?? "",
        shop_phone: data.shop_phone ?? "",
        shop_logo_url: data.shop_logo_url ?? "",
        full_name: data.full_name ?? "",
      });
      setLoading(false);
    });
  }, [user]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ ...form, language: lang }).eq("id", user!.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
  };

  const changePassword = async () => {
    if (newPwd.length < 6) { toast.error("Min 6 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) { toast.error(error.message); return; }
    setNewPwd("");
    toast.success(t("saved"));
  };

  if (loading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-black">{t("settings")}</h1>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">{t("shopInformation")}</h2>
        </div>
        {form.shop_logo_url && <img src={form.shop_logo_url} alt="logo" className="h-16 object-contain" />}
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>{t("shopName")}</Label><Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} maxLength={100} /></div>
          <div><Label>{t("shopPhone")}</Label><Input value={form.shop_phone} onChange={(e) => setForm({ ...form, shop_phone: e.target.value })} maxLength={20} /></div>
        </div>
        <div><Label>{t("shopAddress")}</Label><Textarea value={form.shop_address} onChange={(e) => setForm({ ...form, shop_address: e.target.value })} maxLength={500} /></div>
        <div><Label>{t("shopLogo")}</Label><Input value={form.shop_logo_url} onChange={(e) => setForm({ ...form, shop_logo_url: e.target.value })} placeholder="https://..." /></div>
        <div><Label>{t("fullName")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} /></div>
        <Button onClick={save} className="font-bold">{t("save")}</Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-bold">{t("language")}</h2>
        <div className="flex gap-3">
          <Button variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>English</Button>
          <Button variant={lang === "ur" ? "default" : "outline"} onClick={() => setLang("ur")}>اردو</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-xl font-bold">{t("password")}</h2>
        <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="New password" />
        <Button onClick={changePassword}>{t("save")}</Button>
      </Card>

      <Card className="p-6">
        <Button variant="destructive" onClick={() => signOut()}>{t("signOut")}</Button>
      </Card>
    </div>
  );
}
