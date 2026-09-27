"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { useUpgradeGate } from "@/features/billing/upgrade/upgrade-modal";
import { SmartImportDialog } from "@/features/dashboard/data/import";

/**
 * "Import from a spreadsheet" on the storefront step, for an owner who
 * already has a full menu somewhere. Gated to POS: below it, the upgrade
 * modal explains the feature; on POS and up it opens Smart Import for
 * products. Rendered inside an UpgradeGateProvider.
 */
export function CsvImportEntry({ storeId, disabled }: { storeId: string; disabled?: boolean }) {
  const { t } = useI18n();
  const { requireFeature } = useUpgradeGate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          if (requireFeature("POS", t("onboarding.storefront.menu.importFeature"))) {
            setOpen(true);
          }
        }}
        className="h-10 rounded-xl"
      >
        <FileSpreadsheet aria-hidden="true" />
        {t("onboarding.storefront.menu.importCta")}
      </Button>
      <SmartImportDialog
        open={open}
        onOpenChange={setOpen}
        storeId={storeId}
        defaultEntityType="product"
      />
    </>
  );
}
