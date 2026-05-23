"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { storefrontApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorefrontSettings } from "./storefront-settings";
import { MenuEditor } from "./menu-editor";
import { StorefrontAnalytics } from "./storefront-analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/lang/i18n-provider";

interface StorefrontEditorClientProps {
  storeId: string;
}

export function StorefrontEditorClient({ storeId }: StorefrontEditorClientProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("settings");

  const { data: storefront, isLoading, refetch } = useQuery({
    queryKey: ["storefront", storeId],
    queryFn: () => storefrontApi.getStorefront(storeId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("storefront.editor.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("storefront.editor.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full overflow-x-auto border border-border bg-muted/30 p-1 sm:w-auto sm:inline-flex">
          <TabsTrigger value="settings" className="shrink-0 data-[state=active]:bg-card data-[state=active]:text-[var(--epi-gold-400)]">
            {t("storefront.editor.tabs.settings")}
          </TabsTrigger>
          <TabsTrigger value="menu" className="shrink-0 data-[state=active]:bg-card data-[state=active]:text-[var(--epi-gold-400)]">
            {t("storefront.editor.tabs.menu")}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="shrink-0 data-[state=active]:bg-card data-[state=active]:text-[var(--epi-gold-400)]">
            {t("storefront.editor.tabs.analytics")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 m-0">
          <StorefrontSettings storeId={storeId} initialData={storefront} onSuccess={() => refetch()} />
        </TabsContent>

        <TabsContent value="menu" className="space-y-6 m-0">
          <MenuEditor
            storeId={storeId}
            storefrontId={storefront?.id}
            categories={storefront?.menuCategories || []}
            onSuccess={() => refetch()}
          />
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <StorefrontAnalytics storefront={storefront} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
