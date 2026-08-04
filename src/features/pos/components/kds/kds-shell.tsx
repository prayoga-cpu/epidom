"use client";

import { useState } from "react";
import { usePosOrders } from "../../hooks/use-pos-orders";
import { useKdsSettings, useUpdateKdsSettings } from "../../hooks/use-kds-settings";
import { KdsColumn } from "./kds-column";
import { itemDepartment, type KdsDepartment } from "./kds-department";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ChefHat, Wine, Power } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { toast } from "sonner";
import type { PosOrderDisplay } from "../../types/pos.types";

interface KdsShellProps {
  storeId: string;
  /** Whether the current session may flip the on/off toggle — the store
   * owner only, even if a staff PIN session has this page in allowedPages. */
  canManageSettings: boolean;
}

const DEPARTMENTS: { key: KdsDepartment; icon: typeof ChefHat }[] = [
  { key: "KITCHEN", icon: ChefHat },
  { key: "BAR", icon: Wine },
];

export function KdsShell({ storeId, canManageSettings }: KdsShellProps) {
  const { t } = useI18n();
  const { data: orders, isLoading } = usePosOrders(storeId);
  const { data: settings, isLoading: isLoadingSettings } = useKdsSettings(storeId);
  const updateSettings = useUpdateKdsSettings(storeId);
  const [department, setDepartment] = useState<KdsDepartment>("KITCHEN");

  const handleToggle = async (checked: boolean) => {
    try {
      await updateSettings.mutateAsync(checked);
      toast.success(checked ? t("pos.kds.enabledToast") : t("pos.kds.disabledToast"));
    } catch {
      toast.error(t("pos.kds.settingsUpdateFailed"));
    }
  };

  if (isLoading || isLoadingSettings) {
    return (
      <div className="flex gap-4 overflow-x-auto p-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex min-w-[300px] flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const enabled = settings?.kitchenDisplayEnabled ?? true;
  const activeOrders = (orders ?? []) as PosOrderDisplay[];

  const preparing = activeOrders.filter(
    (o) =>
      o.status !== "READY" &&
      o.items.some(
        (i) =>
          itemDepartment(i) === department &&
          i.status !== "READY" &&
          i.status !== "SERVED" &&
          i.status !== "CANCELLED"
      )
  );
  const ready = activeOrders.filter(
    (o) => o.status === "READY" && o.items.some((i) => itemDepartment(i) === department)
  );

  return (
    <div className="flex h-full flex-col">
      {/* Department tabs + on/off toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div className="bg-muted flex items-center gap-1 rounded-lg p-1">
          {DEPARTMENTS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDepartment(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                department === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t(key === "KITCHEN" ? "pos.kds.tabKitchen" : "pos.kds.tabBar")}
            </button>
          ))}
        </div>

        {canManageSettings && (
          <div className="flex items-center gap-2">
            <Power className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-sm">{t("pos.kds.enabledLabel")}</span>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={updateSettings.isPending}
            />
          </div>
        )}
      </div>

      {!enabled ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="bg-muted rounded-full p-6">
            <Power className="h-10 w-10 opacity-40" />
          </div>
          <p className="text-foreground text-lg font-medium">{t("pos.kds.disabledTitle")}</p>
          <p className="max-w-sm text-sm">{t("pos.kds.disabledDesc")}</p>
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4">
          <div className="bg-muted rounded-full p-6">
            <ChefHat className="h-10 w-10 opacity-40" />
          </div>
          <p className="text-foreground text-lg font-medium">{t("pos.kds.allDone")}</p>
          <p className="text-sm">{t("pos.kds.noActiveOrders")}</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          <KdsColumn
            title={t("pos.kds.processingColumn")}
            orders={preparing}
            storeId={storeId}
            department={department}
            emptyLabel={t("pos.kds.emptyProcessing")}
          />
          <KdsColumn
            title={t("pos.kds.readyColumn")}
            orders={ready}
            storeId={storeId}
            department={department}
            emptyLabel={t("pos.kds.emptyReady")}
          />
        </div>
      )}
    </div>
  );
}
