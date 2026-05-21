"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, MousePointerClick, TrendingUp } from "lucide-react";

interface StorefrontAnalyticsProps {
  storefront: any;
}

export function StorefrontAnalytics({ storefront }: StorefrontAnalyticsProps) {
  // Placeholder data for MVP, viewCount is real from db
  const stats = [
    {
      title: "Total Pengunjung",
      value: storefront?.viewCount?.toLocaleString() || "0",
      description: "Kali toko dilihat",
      icon: Eye,
      trend: "+12% dari minggu lalu",
    },
    {
      title: "Menu Dilihat",
      value: "Coming Soon",
      description: "Klik pada menu",
      icon: MousePointerClick,
      trend: "Fitur dalam pengembangan",
    },
    {
      title: "Konversi Chat",
      value: "Coming Soon",
      description: "Klik tombol WhatsApp",
      icon: TrendingUp,
      trend: "Fitur dalam pengembangan",
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
              <p className="text-xs text-blue-500 mt-2 font-medium bg-blue-50 w-fit px-2 py-0.5 rounded">
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grafik Pengunjung</CardTitle>
          <CardDescription>Visualisasi jumlah pengunjung harian akan tampil di sini.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-slate-50 rounded-xl border border-dashed flex flex-col items-center justify-center text-slate-400">
            <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
            <p className="font-medium">Data sedang dikumpulkan</p>
            <p className="text-sm mt-1">Grafik akan muncul setelah ada minimal 10 pengunjung.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
