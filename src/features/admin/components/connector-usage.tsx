import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USAGE_RANGES, type ConnectorUsage } from "@/lib/mcp/usage";

/** Admin → Claude connector: how much the connector is used, and where it fails. */
export function ConnectorUsageView({ usage }: { usage: ConnectorUsage }) {
  const errorRate = usage.totals.calls > 0 ? (usage.totals.errors / usage.totals.calls) * 100 : 0;
  const stats = [
    { label: "Tool calls", value: usage.totals.calls.toLocaleString("en") },
    { label: "Errors", value: `${usage.totals.errors} · ${errorRate.toFixed(1)}%` },
    { label: "Accounts", value: String(usage.totals.accounts) },
    { label: "Stores", value: String(usage.totals.stores) },
    { label: "Connections allowed", value: String(usage.totals.connections) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6" aria-hidden />
            Claude connector
          </h1>
          <p className="text-muted-foreground text-sm">
            Tool calls from people&apos;s own Claude (Enterprise stores). Arguments and results are
            never stored. Errors include refusals (plan, staff access) as well as failures.
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
              <Link href={`/admin/claude-connector?days=${days}`}>{days} days</Link>
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
          title="By tool"
          empty="No tool calls yet."
          head={["Tool", "Calls", "Errors", "Avg time"]}
          rows={usage.byTool.map((t) => [
            t.tool,
            String(t.calls),
            String(t.errors),
            `${t.avgMs} ms`,
          ])}
        />
        <UsageTable
          title="By day (UTC)"
          empty="No tool calls yet."
          head={["Day", "Calls", "Errors"]}
          rows={usage.byDay.map((d) => [d.day, String(d.calls), String(d.errors)])}
        />
        <UsageTable
          title="Most active stores"
          empty="No store has used it yet."
          head={["Store", "Calls"]}
          rows={usage.byStore.map((s) => [s.name, String(s.calls)])}
        />
        <UsageTable
          title="Recent errors"
          empty="No errors in this period."
          head={["When (UTC)", "Tool", "Code", "Store"]}
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
