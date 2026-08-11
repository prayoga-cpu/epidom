"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";

type Department = "KITCHEN" | "BAR" | "CUSTOM";

interface PosDepartmentBarProps {
  selectedDepartment: Department | null;
  onSelectDepartment: (department: Department | null) => void;
  // Store-owner-authored label for the optional second product line (e.g.
  // "Hair Salon") — the third pill only renders when this is provided
  // (i.e. the store has the feature enabled and there's something to
  // filter to). See Store.customProductsEnabled/customProductsLabel.
  customDepartmentLabel?: string | null;
}

/**
 * A compact Kitchen/Bar(/Custom) toggle, independent of the menu-category
 * pill bar below it — a cashier can narrow to "Bar" items within whichever
 * category tab is active, since department and menu category are separate
 * dimensions (an item's category doesn't determine its department).
 */
export function PosDepartmentBar({
  selectedDepartment,
  onSelectDepartment,
  customDepartmentLabel,
}: PosDepartmentBarProps) {
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        size="sm"
        variant={selectedDepartment === null ? "default" : "outline"}
        className="shrink-0 rounded-full"
        onClick={() => onSelectDepartment(null)}
      >
        {t("filters.allDepartments")}
      </Button>
      <Button
        size="sm"
        variant={selectedDepartment === "KITCHEN" ? "default" : "outline"}
        className="shrink-0 rounded-full"
        onClick={() => onSelectDepartment(selectedDepartment === "KITCHEN" ? null : "KITCHEN")}
      >
        {t("common.departmentKitchen")}
      </Button>
      <Button
        size="sm"
        variant={selectedDepartment === "BAR" ? "default" : "outline"}
        className="shrink-0 rounded-full"
        onClick={() => onSelectDepartment(selectedDepartment === "BAR" ? null : "BAR")}
      >
        {t("common.departmentBar")}
      </Button>
      {customDepartmentLabel && (
        <Button
          size="sm"
          variant={selectedDepartment === "CUSTOM" ? "default" : "outline"}
          className="shrink-0 rounded-full"
          onClick={() => onSelectDepartment(selectedDepartment === "CUSTOM" ? null : "CUSTOM")}
        >
          {customDepartmentLabel}
        </Button>
      )}
    </div>
  );
}
