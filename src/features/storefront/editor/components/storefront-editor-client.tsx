"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storefrontApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorefrontSettings } from "./storefront-settings";
import { MenuManager } from "./menu-manager";
import { StorefrontAnalytics } from "./storefront-analytics";
import { StorefrontReviews } from "./storefront-reviews";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/lang/i18n-provider";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { planHasFeature, upgradeHrefFor, type PlanTier } from "@/lib/plans/entitlements";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { storeKeys } from "@/features/stores/stores/hooks/use-stores";

interface StorefrontEditorClientProps {
  storeId: string;
}

const VALID_TABS = ["settings", "menu", "reviews", "analytics"] as const;
type StorefrontTab = (typeof VALID_TABS)[number];

export function StorefrontEditorClient({ storeId }: StorefrontEditorClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ?tab= sync (mirrors finance-client.tsx's own useSearchParams/useRouter
  // idiom): the retired standalone /menu page now redirects here with
  // ?tab=menu, so a bookmark/shared link into "the menu editor" still lands
  // on the right tab instead of always resetting to Settings.
  const tabParam = searchParams.get("tab");
  const initialTab: StorefrontTab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as StorefrontTab)
    : "settings";
  const [activeTab, setActiveTab] = useState<StorefrontTab>(initialTab);

  const setTab = (tab: string) => {
    setActiveTab(tab as StorefrontTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const queryClient = useQueryClient();
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

  // A staff persona granted only "/menu" (not "/storefront") — the narrower
  // permission the retired standalone /menu page used to enforce — sees just
  // the menu editor here, no Settings/Analytics tabs, matching that old
  // page's behavior exactly. Role-based unrestricted check mirrors
  // sidebar.tsx's own staffAllowedPages pattern.
  const posSession = usePosSession();
  const isMenuOnlyStaff =
    posSession.isActive &&
    posSession.storeId === storeId &&
    posSession.staffRole !== "OWNER" &&
    posSession.allowedPages !== null &&
    posSession.allowedPages.includes("/menu") &&
    !posSession.allowedPages.includes("/storefront");

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

  if (isMenuOnlyStaff) {
    return (
      <div className="flex flex-col gap-2 sm:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {hasPos ? t("storefront.editor.tabs.menu") : t("storefront.editor.tabs.storeMenu")}
          </h1>
        </div>
        <MenuManager storeId={storeId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("storefront.editor.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("storefront.editor.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setTab} className="space-y-2 sm:space-y-6">
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
            value="reviews"
            className="data-[state=active]:bg-card shrink-0 data-[state=active]:text-[var(--epi-gold-400)]"
          >
            {t("storefront.editor.tabs.reviews")}
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
            onSuccess={() => {
              refetch();
              // The Your Stores cards show this storefront's logo, cover, colour
              // and slogan (GET /api/stores/overview, keyed under ["stores"]).
              queryClient.invalidateQueries({ queryKey: storeKeys.all });
            }}
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

        <TabsContent value="reviews" className="m-0">
          <StorefrontReviews storeId={storeId} storefront={storefront} onSaved={() => refetch()} />
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <StorefrontAnalytics storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
