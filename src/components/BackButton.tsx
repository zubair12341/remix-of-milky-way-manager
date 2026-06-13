import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const navigate = useNavigate();
  const { t, dir } = useLang();
  const Icon = dir === "rtl" ? ArrowRight : ArrowLeft;
  return (
    <Button
      variant="outline"
      size="lg"
      className="h-14 px-6 text-lg font-bold gap-2 mb-4"
      onClick={() => navigate({ to: "/dashboard" })}
    >
      <Icon className="w-6 h-6" /> {t("back")}
    </Button>
  );
}
