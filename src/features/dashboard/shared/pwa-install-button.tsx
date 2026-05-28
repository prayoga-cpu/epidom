"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useI18n } from "@/components/lang/i18n-provider";

export function PwaInstallButton() {
  const { canInstall, install } = usePwaInstall();
  const { t } = useI18n();

  if (!canInstall) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 hover:bg-white/10"
      style={{ color: "var(--epi-cream-50)" }}
      onClick={install}
      title={t("common.pwa.installApp") || "Install app"}
      aria-label={t("common.pwa.installApp") || "Install app"}
    >
      <Download className="size-4" />
    </Button>
  );
}
