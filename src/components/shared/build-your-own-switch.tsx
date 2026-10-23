"use client";

import type { ReactNode } from "react";
import { Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

interface BuildYourOwnSwitchProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** What turning it on does for this kind of item (product vs menu item). */
  description: string;
  disabled?: boolean;
  /** Notes shown under the switch while it is on. */
  children?: ReactNode;
}

/**
 * The "Build Your Own" setting, shared by the Product dialogs (Data) and the
 * storefront Menu editor. Off by default. Turning it on shows the item's
 * option groups as numbered steps at the till and on the storefront.
 */
export function BuildYourOwnSwitch({
  id,
  checked,
  onCheckedChange,
  description,
  disabled,
  children,
}: BuildYourOwnSwitchProps) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        checked ? "border-primary bg-primary/5" : "border-input"
      )}
    >
      <label
        htmlFor={id}
        className={cn("flex min-h-11 items-start gap-3", !disabled && "cursor-pointer")}
      >
        <Layers className="text-primary mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{t("data.products.byo.title")}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span>
        </span>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className="mt-0.5 shrink-0"
        />
      </label>
      {checked && children && <div className="mt-2 space-y-2 pl-7">{children}</div>}
    </div>
  );
}
