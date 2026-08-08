"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";

export function ReceiptPrintButton() {
  const { t } = useI18n();
  return (
    <Button onClick={() => window.print()} className="gap-2">
      <Printer className="h-4 w-4" />
      {t("publicOrder.receiptPage.print")}
    </Button>
  );
}
