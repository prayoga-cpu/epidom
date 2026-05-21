"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils/formatting";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

interface SummaryData {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  orderCount: number;
  buckets: { date: string; revenue: number }[];
}

interface ChannelRow {
  source: string;
  label: string;
  orderCount: number;
  revenue: number;
  commissionPct: number;
  commissionAmount: number;
  netRevenue: number;
}

interface TopItem {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

interface FinanceClientProps {
  storeId: string;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}
function today() {
  return new Date().toISOString().split("T")[0];
}

export function FinanceClient({ storeId }: FinanceClientProps) {
  const { t } = useI18n();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());

  const params = `from=${from}T00:00:00Z&to=${to}T23:59:59Z`;
  const base = `/api/stores/${storeId}/finance`;

  const summary = useQuery({
    queryKey: ["finance-summary", storeId, from, to],
    queryFn: () => apiClient.get<SummaryData>(`${base}/summary?${params}`),
  });

  const channels = useQuery({
    queryKey: ["finance-channels", storeId, from, to],
    queryFn: () => apiClient.get<{ channels: ChannelRow[] }>(`${base}/channels?${params}`),
  });

  const topItems = useQuery({
    queryKey: ["finance-top-items", storeId, from, to],
    queryFn: () => apiClient.get<{ items: TopItem[] }>(`${base}/top-items?${params}&limit=20`),
  });

  function exportXlsx() {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    if (summary.data) {
      const s = summary.data;
      const rows = [
        ["Periode", `${from} — ${to}`],
        ["Total Pesanan", s.orderCount],
        ["Pendapatan", s.revenue],
        ["HPP (COGS)", s.cogs],
        ["Laba Kotor", s.grossProfit],
        ["Margin Kotor (%)", s.grossMarginPct],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Ringkasan");
    }

    // Channels sheet
    if (channels.data?.channels?.length) {
      const header = ["Channel", "Pesanan", "Pendapatan", "Komisi (%)", "Komisi (Rp)", "Bersih"];
      const rows = channels.data.channels.map((c) => [
        c.label, c.orderCount, c.revenue, c.commissionPct, c.commissionAmount, c.netRevenue,
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Per Channel");
    }

    // Top items sheet
    if (topItems.data?.items?.length) {
      const header = ["Item", "Pesanan", "Qty Terjual", "Pendapatan"];
      const rows = topItems.data.items.map((i) => [
        i.name, i.orderCount, i.totalQuantity, i.totalRevenue,
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Top Item");
    }

    XLSX.writeFile(wb, `laporan-keuangan-${from}-${to}.xlsx`);
  }

  const s = summary.data;

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("pages.financeTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("pages.financeDesc")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportXlsx} className="shrink-0">
          <Download className="mr-2 h-4 w-4" />
          {t("common.actions.exportAsExcel")}
        </Button>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="from">{t("common.from") ?? "Dari"}</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">{t("common.to") ?? "Sampai"}</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* KPI cards */}
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">{t("pages.financeRevenue")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(s.revenue)}</p>
              <p className="text-muted-foreground text-xs">{s.orderCount} {t("pages.financeOrders")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">{t("pages.financeCogs")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(s.cogs)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">{t("pages.financeGrossProfit")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(s.grossProfit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-sm font-medium">{t("pages.financeMargin")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.grossMarginPct.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="channels">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="channels">{t("pages.financeChannels")}</TabsTrigger>
          <TabsTrigger value="items">{t("pages.financeTopItems")}</TabsTrigger>
          <TabsTrigger value="daily">{t("pages.financeDaily")}</TabsTrigger>
        </TabsList>

        {/* Channels tab */}
        <TabsContent value="channels">
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pages.financeChannel")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeOrders")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeCommission")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeNetRevenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-muted-foreground py-8 text-center">{t("common.loading")}</TableCell></TableRow>
                  ) : (channels.data?.channels ?? []).map((c) => (
                    <TableRow key={c.source}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-right">{c.orderCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.revenue)}</TableCell>
                      <TableCell className="text-right text-orange-600">
                        {c.commissionPct > 0 ? `-${c.commissionPct}% (${formatCurrency(c.commissionAmount)})` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(c.netRevenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Top items tab */}
        <TabsContent value="items">
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeQtySold")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topItems.isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground py-8 text-center">{t("common.loading")}</TableCell></TableRow>
                  ) : (topItems.data?.items ?? []).map((item, i) => (
                    <TableRow key={item.name}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.totalQuantity}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Daily breakdown tab */}
        <TabsContent value="daily">
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead className="text-right">{t("pages.financeRevenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.isLoading ? (
                    <TableRow><TableCell colSpan={2} className="text-muted-foreground py-8 text-center">{t("common.loading")}</TableCell></TableRow>
                  ) : (s?.buckets ?? []).map((b) => (
                    <TableRow key={b.date}>
                      <TableCell>{b.date}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
