import { useLang } from "@/lib/i18n";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { Milk } from "lucide-react";

type Sale = { slip_number: number; amount: number; operator_name?: string | null; created_at: string };
type Profile = { shop_name?: string | null; shop_address?: string | null; shop_phone?: string | null; shop_logo_url?: string | null };

export function InvoicePrint({ sale, profile }: { sale: Sale; profile: Profile | null }) {
  const { t } = useLang();
  return (
    <div className="print-area mx-auto max-w-sm bg-white text-black p-6 border rounded-lg">
      <div className="text-center mb-4">
        {profile?.shop_logo_url ? (
          <img src={profile.shop_logo_url} alt="logo" className="h-12 mx-auto mb-2 object-contain" />
        ) : (
          <Milk className="w-10 h-10 mx-auto mb-1" />
        )}
        <h2 className="text-xl font-black">{profile?.shop_name ?? "Milk Shop"}</h2>
        {profile?.shop_address && <p className="text-xs">{profile.shop_address}</p>}
        {profile?.shop_phone && <p className="text-xs">{profile.shop_phone}</p>}
      </div>
      <div className="border-t border-b border-dashed py-3 my-3 text-sm space-y-1">
        <div className="flex justify-between"><span>{t("slipNo")}</span><span className="font-bold">{sale.slip_number}</span></div>
        <div className="flex justify-between"><span>{t("date")}</span><span>{fmtDateTime(sale.created_at)}</span></div>
        {sale.operator_name && <div className="flex justify-between"><span>{t("operator")}</span><span>{sale.operator_name}</span></div>}
      </div>
      <div className="text-center my-4">
        <p className="text-xs uppercase tracking-wide">{t("amount")}</p>
        <p className="text-3xl font-black mt-1">{fmtMoney(sale.amount)}</p>
      </div>
      <p className="text-center text-xs border-t border-dashed pt-3">{t("thankYou")}</p>
    </div>
  );
}
