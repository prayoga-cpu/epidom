"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/components/lang/i18n-provider";
import { USAGE_RANGES, type ConnectorUsage } from "@/lib/mcp/usage-shared";

/** Admin → Claude connector: how much the connector is used, and where it fails. */
export function ConnectorUsageView({ usage }: { usage: ConnectorUsage }) {
  const { t, intlLocale } = useI18n();
  const C = (key: string) => t(`adminConnector.${key}`);
  const errorRate = usage.totals.calls > 0 ? (usage.totals.errors / usage.totals.calls) * 100 : 0;
  const stats = [
    { label: C("stats.toolCalls"), value: usage.totals.calls.toLocaleString(intlLocale) },
    { label: C("stats.errors"), value: `${usage.totals.errors} · ${errorRate.toFixed(1)}%` },
    { label: C("stats.accounts"), value: String(usage.totals.accounts) },
    { label: C("stats.stores"), value: String(usage.totals.stores) },
    { label: C("stats.connections"), value: String(usage.totals.connections) },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6" aria-hidden />
            {C("title")}
            <Badge variant="outline" className="text-xs font-semibold">
              {C("beta")}
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            {C("desc")}
          </p>
        </div>
        <div className="flex gap-2">
          {USAGE_RANGES.map((days) => (
            <Button
              key={days}
              asChild
              size="sm"
              variant={usage.days === days ? "default" : "outline"}
              className="h-10"
            >
              <Link href={`/admin/claude-connector?days=${days}`}>
                {C("days").replace("{days}", String(days))}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="space-y-1 p-4">
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="text-xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageTable
          title={C("tables.byTool")}
          empty={C("empty.noCalls")}
          head={[C("head.tool"), C("head.calls"), C("head.errors"), C("head.avgTime")]}
          rows={usage.byTool.map((row) => [
            row.tool,
            String(row.calls),
            String(row.errors),
            `${row.avgMs} ms`,
          ])}
        />
        <UsageTable
          title={C("tables.byDay")}
          empty={C("empty.noCalls")}
          head={[C("head.day"), C("head.calls"), C("head.errors")]}
          rows={usage.byDay.map((d) => [d.day, String(d.calls), String(d.errors)])}
        />
        <UsageTable
          title={C("tables.byStore")}
          empty={C("empty.noStore")}
          head={[C("head.store"), C("head.calls")]}
          rows={usage.byStore.map((s) => [s.name, String(s.calls)])}
        />
        <UsageTable
          title={C("tables.recentErrors")}
          empty={C("empty.noErrors")}
          head={[C("head.when"), C("head.tool"), C("head.code"), C("head.store")]}
          rows={usage.recentErrors.map((e) => [
            e.at.slice(0, 16).replace("T", " "),
            e.tool,
            e.errorCode ?? "—",
            e.store ?? "—",
          ])}
        />
      </div>
    </div>
  );
}

function UsageTable({
  title,
  head,
  rows,
  empty,
}: {
  title: string;
  head: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{empty}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[420px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {head.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className={j === 0 ? "font-medium" : undefined}>
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
