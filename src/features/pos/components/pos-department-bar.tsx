"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";

type Department = "KITCHEN" | "BAR";

interface PosDepartmentBarProps {
  selectedDepartment: Department | null;
  onSelectDepartment: (department: Department | null) => void;
}

/**
 * A compact Kitchen/Bar toggle, independent of the menu-category pill bar
 * below it — a cashier can narrow to "Bar" items within whichever category
 * tab is active, since department and menu category are separate
 * dimensions (an item's category doesn't determine its department).
 */
export function PosDepartmentBar({
  selectedDepartment,
  onSelectDepartment,
}: PosDepartmentBarProps) {
  const { t } = useI18n();

  return (
    <div className="bg-background flex items-center gap-2 border-b px-4 py-3">
      <Button
        size="sm"
        variant={selectedDepartment === null ? "default" : "outline"}
        className="rounded-full"
        onClick={() => onSelectDepartment(null)}
      >
        {t("filters.allDepartments")}
      </Button>
      <Button
        size="sm"
        variant={selectedDepartment === "KITCHEN" ? "default" : "outline"}
        className="rounded-full"
        onClick={() => onSelectDepartment(selectedDepartment === "KITCHEN" ? null : "KITCHEN")}
      >
        {t("common.departmentKitchen")}
      </Button>
      <Button
        size="sm"
        variant={selectedDepartment === "BAR" ? "default" : "outline"}
        className="rounded-full"
        onClick={() => onSelectDepartment(selectedDepartment === "BAR" ? null : "BAR")}
      >
        {t("common.departmentBar")}
      </Button>
    </div>
  );
}
