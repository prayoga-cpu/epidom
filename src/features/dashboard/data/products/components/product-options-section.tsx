"use client";

import { Button } from "@/components/ui/button";
import { BuildYourOwnSwitch } from "@/components/shared/build-your-own-switch";
import { OptionGroupsEditor } from "@/components/shared/option-groups-editor";
import { useI18n } from "@/components/lang/i18n-provider";
import type { ProductOptionGroupInput } from "@/lib/validation/inventory.schemas";
import { hasLinkedMaterial } from "@/lib/utils/menu-item-options";

type StockModeValue = "BATCH_PRODUCED" | "MADE_TO_ORDER" | "UNTRACKED";

interface ProductOptionsSectionProps {
  storeId: string;
  /** Prefix for element ids, unique per dialog. */
  idPrefix: string;
  buildYourOwn: boolean;
  onBuildYourOwnChange: (on: boolean) => void;
  optionGroups: ProductOptionGroupInput[];
  onOptionGroupsChange: (groups: ProductOptionGroupInput[]) => void;
  stockMode: StockModeValue;
  /** Switches the form to made to order (the edit dialog confirms first). */
  onUseMadeToOrder: () => void;
}

/**
 * The Options block of the Add/Edit Product dialogs, with the Build Your Own
 * switch on top. With it on, the same option groups are edited as numbered
 * steps; each choice can still link a raw material, which is what deducts
 * stock when the item is sold.
 */
export function ProductOptionsSection({
  storeId,
  idPrefix,
  buildYourOwn,
  onBuildYourOwnChange,
  optionGroups,
  onOptionGroupsChange,
  stockMode,
  onUseMadeToOrder,
}: ProductOptionsSectionProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
        {t(buildYourOwn ? "data.products.byo.stepsTitle" : "data.products.sections.options")}
      </h3>

      <BuildYourOwnSwitch
        id={`${idPrefix}-build-your-own`}
        checked={buildYourOwn}
        onCheckedChange={onBuildYourOwnChange}
        description={t("data.products.byo.productDescription")}
      >
        {stockMode === "MADE_TO_ORDER" ? (
          <p className="text-muted-foreground text-xs">{t("data.products.byo.madeToOrderOn")}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("data.products.byo.madeToOrderHint")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0"
              onClick={onUseMadeToOrder}
            >
              {t("data.products.byo.useMadeToOrder")}
            </Button>
          </div>
        )}
        {!hasLinkedMaterial(optionGroups) && (
          <p className="text-muted-foreground text-xs">{t("data.products.byo.linkMaterialHint")}</p>
        )}
      </BuildYourOwnSwitch>

      <p className="text-muted-foreground text-xs">
        {t(
          buildYourOwn ? "data.products.byo.stepsDescription" : "data.products.options.description"
        )}
      </p>
      <OptionGroupsEditor
        storeId={storeId}
        value={optionGroups}
        onChange={onOptionGroupsChange}
        allowMaterialLink
        variant={buildYourOwn ? "steps" : "options"}
      />
    </div>
  );
}
