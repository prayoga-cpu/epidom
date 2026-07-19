"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, MousePointerClick, TrendingUp } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";

interface StorefrontAnalyticsProps {
  storefront: any;
}

export function StorefrontAnalytics({ storefront }: StorefrontAnalyticsProps) {
  const { t } = useI18n();

  const stats = [
    {
      title: t("storefront.analytics.totalVisitors"),
      value: storefront?.viewCount?.toLocaleString() || "0",
      description: t("storefront.analytics.totalVisitorsDesc"),
      icon: Eye,
      trend: t("storefront.analytics.trendLastWeek"),
    },
    {
      title: t("storefront.analytics.menuViewed"),
      value: t("storefront.analytics.comingSoon"),
      description: t("storefront.analytics.menuViewedDesc"),
      icon: MousePointerClick,
      trend: t("storefront.analytics.featureInDev"),
    },
    {
      title: t("storefront.analytics.chatConversion"),
      value: t("storefront.analytics.comingSoon"),
      description: t("storefront.analytics.chatConversionDesc"),
      icon: TrendingUp,
      trend: t("storefront.analytics.featureInDev"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-muted-foreground mt-1 text-xs">{stat.description}</p>
              <p className="text-muted-foreground bg-muted mt-2 w-fit rounded px-2 py-0.5 text-xs font-medium">
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("storefront.analytics.visitorChart")}</CardTitle>
          <CardDescription>{t("storefront.analytics.visitorChartDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 text-muted-foreground flex h-[300px] w-full flex-col items-center justify-center rounded-xl border border-dashed">
            <TrendingUp className="mb-3 h-10 w-10 opacity-20" />
            <p className="font-medium">{t("storefront.analytics.dataCollecting")}</p>
            <p className="mt-1 text-sm">{t("storefront.analytics.dataCollectingDesc")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
