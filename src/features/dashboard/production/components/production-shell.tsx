"use client";

import { Factory, Power } from "lucide-react";
import { BatchFlowDiagram } from "./batch-flow-diagram";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useProductionSettings,
  useUpdateProductionSettings,
} from "../hooks/use-production-settings";
import { RecipeProductionCard } from "../recipe-production/recipe-production";
import { PrepListPanel } from "../prep-list/prep-list-panel";
import { ProductionHistoryCard } from "../production-history/production-history";

interface ProductionShellProps {
  storeId: string;
  /** Whether the current session may flip the on/off toggle — the store
   * owner only, even if a staff PIN session has this page in allowedPages. */
  canManageSettings: boolean;
}

export function ProductionShell({ storeId, canManageSettings }: ProductionShellProps) {
  const { t } = useI18n();
  const { data: settings, isLoading } = useProductionSettings(storeId);
  const updateSettings = useUpdateProductionSettings(storeId);

  const enabled = settings?.productionEnabled ?? false;

  const handleToggle = async (checked: boolean) => {
    try {
      await updateSettings.mutateAsync(checked);
      toast.success(
        checked ? t("production.guide.enabledToast") : t("production.guide.disabledToast")
      );
    } catch {
      toast.error(t("production.guide.settingsUpdateFailed"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <div className="bg-muted rounded-full p-4">
              <Factory className="text-muted-foreground h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold">{t("production.guide.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("production.guide.description")}</p>
            {/* The bakery is the canonical case for this feature, and the part
                people get wrong is WHERE the ingredients leave — once at the
                bake, not again at the till. */}
            <BatchFlowDiagram />
            <div className="w-full space-y-2 text-left text-sm">
              <div className="rounded-lg border p-3">
                <p className="font-medium">{t("production.guide.whoForTitle")}</p>
                <p className="text-muted-foreground">{t("production.guide.whoFor")}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-medium">{t("production.guide.whoSkipTitle")}</p>
                <p className="text-muted-foreground">{t("production.guide.whoSkip")}</p>
              </div>
              {/* The make-ahead / cook-to-order split is the single thing owners
                  get wrong about this screen: cook-to-order dishes never need a
                  production log because their ingredients come out at sale. */}
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">{t("production.emptyState.batchOnly")}</p>
              </div>
            </div>
            {canManageSettings ? (
              <Button
                onClick={() => handleToggle(true)}
                disabled={updateSettings.isPending}
                className="w-full"
              >
                {updateSettings.isPending
                  ? t("production.guide.enabling")
                  : t("production.guide.enableButton")}
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("production.guide.ownerOnlyNotice")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("production.pageTitle")}</h1>
        {canManageSettings && (
          <div className="flex items-center gap-2">
            <Power className="text-muted-foreground h-4 w-4" />
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={updateSettings.isPending}
            />
          </div>
        )}
      </div>
      <Tabs defaultValue="produce" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
          <TabsTrigger value="produce">{t("production.tabs.produce")}</TabsTrigger>
          <TabsTrigger value="history">{t("production.tabs.history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="produce" className="mt-4 space-y-4">
          {/* Above the recipe list on purpose: "what do I need to make right
              now" is the question staff actually open this tab with. */}
          <PrepListPanel storeId={storeId} />
          <RecipeProductionCard />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <ProductionHistoryCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
