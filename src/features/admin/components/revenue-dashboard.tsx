"use client";

import { useQuery } from "@tanstack/react-query";
import { Euro, TrendingUp, Wallet, ArrowRightLeft, Users, Building, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueData {
  totalMonthlyRevenueEur: number;
  epidomShare: number;
  developerShare: number;
  breakdown: {
    posCount: number;
    posPrice: number;
    operationsCount: number;
    operationsPrice: number;
  };
}

export function RevenueDashboard() {
  const { data, isLoading, error } = useQuery<{ data: RevenueData }>({
    queryKey: ["admin-revenue"],
    queryFn: () => fetch("/api/admin/revenue").then((res) => {
      if (!res.ok) throw new Error("Failed to fetch revenue");
      return res.json();
    }),
  });

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load revenue data.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const revenue = data?.data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Revenue Split Report</h1>
              <p className="text-xs text-muted-foreground">Monthly Recurring Revenue (MRR) tracking</p>
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Info Alert */}
        <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-400">
          <ArrowRightLeft className="h-4 w-4 text-blue-400" />
          <AlertTitle>Manual Payout System Active</AlertTitle>
          <AlertDescription className="text-blue-400/80 mt-1">
            All subscription payments go 100% to the main Epidom Stripe account in France.
            Use this report to calculate the 40% share for the developer at the end of each month.
            The developer's share should be sent manually via Wise or Crypto.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Total MRR Card */}
          <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-emerald-500/80 font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" /> Total MRR (100%)
              </CardDescription>
              <CardTitle className="text-4xl text-emerald-400">
                {isLoading ? <Skeleton className="h-10 w-32" /> : `€${revenue?.totalMonthlyRevenueEur.toFixed(2)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Total monthly revenue from all active subscriptions.
              </p>
            </CardContent>
          </Card>

          {/* Epidom Share Card */}
          <Card className="border-blue-500/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-500" /> Epidom Share (60%)
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? <Skeleton className="h-8 w-24" /> : `€${revenue?.epidomShare.toFixed(2)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Retained in the main Stripe account.
              </p>
            </CardContent>
          </Card>

          {/* Developer Share Card */}
          <Card className="border-orange-500/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-orange-500" /> Developer Share (40%)
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? <Skeleton className="h-8 w-24" /> : `€${revenue?.developerShare.toFixed(2)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                To be transferred manually at month-end.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown */}
        <h2 className="text-lg font-semibold tracking-tight mt-8 mb-4">Subscription Breakdown</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* POS Subscriptions */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Starter (POS) Plan
                </CardTitle>
                <div className="text-sm font-medium text-muted-foreground">
                  €{revenue?.breakdown.posPrice}/mo
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-8" /> : revenue?.breakdown.posCount}
                  <span className="text-sm font-normal text-muted-foreground">active stores</span>
                </div>
                <div className="text-lg font-medium text-emerald-400">
                  {isLoading ? <Skeleton className="h-6 w-16" /> : `€${((revenue?.breakdown.posCount || 0) * (revenue?.breakdown.posPrice || 0)).toFixed(2)}`}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OPERATIONS Subscriptions */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  Pro (Operations) Plan
                </CardTitle>
                <div className="text-sm font-medium text-muted-foreground">
                  €{revenue?.breakdown.operationsPrice}/mo
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-8" /> : revenue?.breakdown.operationsCount}
                  <span className="text-sm font-normal text-muted-foreground">active stores</span>
                </div>
                <div className="text-lg font-medium text-emerald-400">
                  {isLoading ? <Skeleton className="h-6 w-16" /> : `€${((revenue?.breakdown.operationsCount || 0) * (revenue?.breakdown.operationsPrice || 0)).toFixed(2)}`}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
