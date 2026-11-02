"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSignature, ShieldAlert, ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatting";
import type { FiscalClosureRow, FiscalSummary } from "@/lib/fiscal/summary";
import type { FiscalVerification } from "@/lib/fiscal/verify";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 min-w-[9rem] flex-1 rounded-xl border px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold break-words tabular-nums">{value}</p>
    </div>
  );
}

/** Calendar month of `now` in the browser's zone, "YYYY-MM". */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The store's fiscal journal (src/lib/fiscal): the chain's state, a check the
 * owner can run on demand, the closures, the monthly archives to download,
 * and, for a business in France, the publisher attestation.
 *
 * Everything here is read-only: the journal is written by the till itself.
 */
export function FiscalJournal({ storeId }: { storeId: string }) {
  const { t, formatDateTime } = useI18n();
  const [closureKind, setClosureKind] = useState<FiscalClosureRow["kind"]>("DAY");

  const summary = useQuery({
    queryKey: ["fiscal-summary", storeId],
    queryFn: () => apiClient.get<FiscalSummary>(`/stores/${storeId}/fiscal`),
  });

  const verify = useMutation({
    mutationFn: () => apiClient.post<FiscalVerification>(`/stores/${storeId}/fiscal/verify`),
  });

  if (summary.isError) {
    return <p className="text-destructive text-sm">{t("fiscal.loadError")}</p>;
  }

  const data = summary.data;
  // Literal in the journal's own currency: never converted, as recorded.
  const money = (value: string) =>
    data ? formatCurrency(Number(value), data.currency, "en-US") : "";
  // t() has no parameters; placeholders are filled here.
  const fill = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t(key));
  const closures = data?.closures.filter((c) => c.kind === closureKind) ?? [];
  const result = verify.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("fiscal.title")}</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">{t("fiscal.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-5" aria-hidden />
              {t("fiscal.status.title")}
            </CardTitle>
            {data && (
              <CardDescription>
                {t("fiscal.status.module")}: {data.module.name} {data.module.version} ·{" "}
                {t("fiscal.status.signingKey")}: {data.signer.keyId ?? t("fiscal.status.noKey")}
              </CardDescription>
            )}
          </div>
          <Button
            className="min-h-10"
            onClick={() => verify.mutate()}
            disabled={verify.isPending || !data}
          >
            {verify.isPending ? t("fiscal.verify.running") : t("fiscal.verify.button")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {data && data.entries.count === 0 ? (
            <p className="text-muted-foreground text-sm">{t("fiscal.status.nothingYet")}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Stat label={t("fiscal.status.records")} value={String(data?.entries.count ?? "…")} />
              <Stat
                label={t("fiscal.status.lastRecord")}
                value={
                  data?.entries.lastRecordedAt ? formatDateTime(data.entries.lastRecordedAt) : "…"
                }
              />
              <Stat
                label={t("fiscal.status.perpetualNet")}
                value={data ? money(data.entries.totalNet) : "…"}
              />
              <Stat
                label={t("fiscal.status.perpetualAbsolute")}
                value={data ? money(data.entries.totalAbsolute) : "…"}
              />
            </div>
          )}

          {data && data.entries.unsigned > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {fill("fiscal.status.unsigned", { count: data.entries.unsigned })}
            </p>
          )}

          {verify.isError && <p className="text-destructive text-sm">{t("fiscal.verify.error")}</p>}
          {result && (
            <div
              role="status"
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                result.ok
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-destructive/40 bg-destructive/10"
              )}
            >
              <p className="flex items-center gap-2 font-medium">
                {result.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                ) : (
                  <ShieldAlert className="text-destructive size-4" aria-hidden />
                )}
                {result.ok
                  ? fill("fiscal.verify.ok", {
                      entries: result.entries.count,
                      closures: result.closures.count,
                      archives: result.archives.count,
                    })
                  : fill("fiscal.verify.problems", { count: result.issues.length })}
              </p>
              {!result.ok && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.issues.map((issue, i) => (
                    <li key={i}>
                      {issue.chain}
                      {issue.seq !== null ? ` #${issue.seq}` : ""}: {issue.problem}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {fill("fiscal.verify.checkedAt", { time: formatDateTime(result.checkedAt) })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.attestation.applicable && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="text-primary size-5" aria-hidden />
              {t("fiscal.attestation.title")}
            </CardTitle>
            <CardDescription className="max-w-3xl">{t("fiscal.attestation.body")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.attestation.ready ? (
              <Button asChild className="min-h-10">
                <Link href={`/store/${storeId}/fiscal/attestation`}>
                  {t("fiscal.attestation.open")}
                </Link>
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">{t("fiscal.attestation.pending")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("fiscal.closures.title")}</CardTitle>
          <CardDescription>{t("fiscal.closures.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={closureKind}
            onValueChange={(v) => setClosureKind(v as FiscalClosureRow["kind"])}
          >
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="DAY">{t("fiscal.closures.day")}</TabsTrigger>
              <TabsTrigger value="MONTH">{t("fiscal.closures.month")}</TabsTrigger>
              <TabsTrigger value="YEAR">{t("fiscal.closures.year")}</TabsTrigger>
            </TabsList>
            <TabsContent value={closureKind} className="mt-3">
              {closures.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("fiscal.closures.empty")}</p>
              ) : (
                <div className="-mx-4 overflow-x-auto sm:mx-0">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("fiscal.closures.period")}</TableHead>
                        <TableHead className="text-right">{t("fiscal.closures.records")}</TableHead>
                        <TableHead className="text-right">{t("fiscal.closures.sales")}</TableHead>
                        <TableHead className="text-right">{t("fiscal.closures.refunds")}</TableHead>
                        <TableHead className="text-right">
                          {t("fiscal.closures.cancellations")}
                        </TableHead>
                        <TableHead className="text-right">{t("fiscal.closures.net")}</TableHead>
                        <TableHead className="text-right">
                          {t("fiscal.closures.perpetual")}
                        </TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closures.map((c) => (
                        <TableRow key={`${c.kind}-${c.period}`}>
                          <TableCell className="font-medium tabular-nums">{c.period}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.entryCount}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(c.salesTotal)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(c.refundsTotal)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(c.cancellationsTotal)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {money(c.net)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(c.totalNet)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.signed ? "secondary" : "outline"}>
                              {c.signed ? t("fiscal.signed") : t("fiscal.notSigned")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("fiscal.archives.title")}</CardTitle>
            <CardDescription className="max-w-3xl">{t("fiscal.archives.hint")}</CardDescription>
          </div>
          <Button asChild variant="outline" className="min-h-10">
            <a href={`/api/stores/${storeId}/fiscal/export?month=${currentMonth()}`} download>
              <Download className="mr-2 size-4" aria-hidden />
              {t("fiscal.archives.exportMonth")}
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          {!data || data.archives.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("fiscal.archives.empty")}</p>
          ) : (
            <ul className="divide-y">
              {data.archives.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">{a.period}</p>
                    <p className="text-muted-foreground text-xs">
                      {fill("fiscal.archives.records", { count: a.entryCount })} ·{" "}
                      {a.signed ? t("fiscal.signed") : t("fiscal.notSigned")} ·{" "}
                      {a.hash.slice(0, 12)}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="min-h-10">
                    <a href={`/api/stores/${storeId}/fiscal/archives/${a.id}`} download>
                      <Download className="mr-2 size-4" aria-hidden />
                      {t("fiscal.archives.download")}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
