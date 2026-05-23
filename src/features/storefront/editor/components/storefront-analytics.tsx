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
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              <p className="text-xs text-muted-foreground mt-2 font-medium bg-muted w-fit px-2 py-0.5 rounded">
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
          <div className="h-[300px] w-full bg-muted/40 rounded-xl border border-dashed flex flex-col items-center justify-center text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
            <p className="font-medium">{t("storefront.analytics.dataCollecting")}</p>
            <p className="text-sm mt-1">{t("storefront.analytics.dataCollectingDesc")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
