"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { storefrontApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorefrontSettings } from "./storefront-settings";
import { MenuManager } from "./menu-manager";
import { StorefrontAnalytics } from "./storefront-analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/lang/i18n-provider";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { planHasFeature, upgradeHrefFor, type PlanTier } from "@/lib/plans/entitlements";

interface StorefrontEditorClientProps {
  storeId: string;
}

export function StorefrontEditorClient({ storeId }: StorefrontEditorClientProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("settings");

  const {
    data: storefront,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["storefront", storeId],
    queryFn: () => storefrontApi.getStorefront(storeId),
  });

  const { data: subData } = useSubscriptionStatus();
  const currentPlan = (subData?.subscription?.plan as PlanTier) ?? "FREE";
  // Below POS, the storefront's menu is display-only — no online ordering/POS
  // selling — so it's framed as "Store Menu" rather than "Menu".
  const hasPos = planHasFeature(currentPlan, "posAccess");

  if (isLoading) {
    return (
      <div className="space-y-2 sm:space-y-6">
        <div>
          {/* w-64/w-96 (fixed px widths) overflowed narrow phones — the real
              title/subtitle wrap there, so the skeleton should shrink with
              the viewport (max-w-full) instead of assuming desktop width. */}
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="mt-2 h-4 w-full max-w-96" />
          <Skeleton className="mt-1.5 h-4 w-2/3 max-w-96 sm:hidden" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("storefront.editor.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("storefront.editor.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2 sm:space-y-6">
        <TabsList className="border-border bg-muted/30 w-full overflow-x-auto border p-1 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-card shrink-0 data-[state=active]:text-[var(--epi-gold-400)]"
          >
            {t("storefront.editor.tabs.settings")}
          </TabsTrigger>
          <TabsTrigger
            value="menu"
            className="data-[state=active]:bg-card shrink-0 data-[state=active]:text-[var(--epi-gold-400)]"
          >
            {hasPos ? t("storefront.editor.tabs.menu") : t("storefront.editor.tabs.storeMenu")}
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-card shrink-0 data-[state=active]:text-[var(--epi-gold-400)]"
          >
            {t("storefront.editor.tabs.analytics")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="m-0 space-y-6">
          <StorefrontSettings
            storeId={storeId}
            initialData={storefront}
            onSuccess={() => refetch()}
          />
        </TabsContent>

        <TabsContent value="menu" className="m-0 space-y-6">
          {!hasPos && (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">{t("storefront.menu.freeHint")}</p>
              <Link
                href={upgradeHrefFor("POS")}
                className="text-primary shrink-0 font-medium underline underline-offset-2"
              >
                {t("billing.upgradeGate.upgradeTo")} POS
              </Link>
            </div>
          )}
          <MenuManager storeId={storeId} />
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <StorefrontAnalytics storefront={storefront} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
