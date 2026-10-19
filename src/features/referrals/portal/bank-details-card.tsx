"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Landmark, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { partnerBankDetailsSchema } from "@/lib/validation/partner.schemas";
import type { PartnerBankDetailsView } from "@/lib/services/partner.service";
import { shortDate } from "@/features/admin/partners/components/partner-bits";

type FormValues = z.input<typeof partnerBankDetailsSchema>;

/** "FR76 3000 6000 0112 3456 7890 189" → "•••• 0189". */
export function maskAccountNumber(value: string): string {
  const compact = value.replace(/[\s-]/g, "");
  return compact.length <= 4 ? compact : `•••• ${compact.slice(-4)}`;
}

const FIELDS: { name: keyof FormValues; label: string; autoComplete: string }[] = [
  { name: "accountHolder", label: "partnerPortal.accountHolder", autoComplete: "name" },
  { name: "bankName", label: "partnerPortal.bankName", autoComplete: "off" },
  { name: "accountNumber", label: "partnerPortal.accountNumber", autoComplete: "off" },
  { name: "swift", label: "partnerPortal.swift", autoComplete: "off" },
];

/**
 * Where Epidom transfers the partner's commission. Entered by the partner,
 * stored encrypted; only they and full admins see it. Shown masked once saved.
 */
export function BankDetailsCard({
  initial,
  locale,
}: {
  initial: PartnerBankDetailsView;
  locale: string;
}) {
  const { t } = useI18n();
  const [view, setView] = useState(initial);
  const [editing, setEditing] = useState(!initial.details);
  const form = useForm<FormValues>({
    resolver: zodResolver(partnerBankDetailsSchema),
    defaultValues: {
      accountHolder: initial.details?.accountHolder ?? "",
      bankName: initial.details?.bankName ?? "",
      accountNumber: initial.details?.accountNumber ?? "",
      swift: initial.details?.swift ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch("/api/partner/me/bank-details", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as PartnerBankDetailsView;
      setView(saved);
      setEditing(false);
      toast.success(t("partnerPortal.bankSaved"));
    } catch {
      toast.error(t("partnerPortal.error"));
    }
  }

  const d = view.details;
  return (
    <Card className={!d ? "border-amber-500/40" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-amber-500" />
            {t("partnerPortal.bankTitle")}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">{t("partnerPortal.bankHelp")}</p>
        </div>
        {d && !editing && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-10 shrink-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t("partnerPortal.bankEdit")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!editing && d ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">{t("partnerPortal.accountHolder")}</dt>
              <dd className="text-foreground">{d.accountHolder}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t("partnerPortal.bankName")}</dt>
              <dd className="text-foreground">{d.bankName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t("partnerPortal.accountNumber")}</dt>
              <dd className="text-foreground tabular-nums">{maskAccountNumber(d.accountNumber)}</dd>
            </div>
            {d.swift && (
              <div>
                <dt className="text-muted-foreground text-xs">{t("partnerPortal.swift")}</dt>
                <dd className="text-foreground">{d.swift}</dd>
              </div>
            )}
            {view.updatedAt && (
              <p className="text-muted-foreground text-xs sm:col-span-2">
                {t("partnerPortal.bankUpdated").replace(
                  "{date}",
                  shortDate(view.updatedAt, locale)
                )}
              </p>
            )}
          </dl>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            {!d && (
              <p className="text-sm text-amber-500">
                {view.unreadable
                  ? t("partnerPortal.bankUnreadable")
                  : t("partnerPortal.bankMissing")}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => {
                const error = form.formState.errors[field.name]?.message;
                const id = `bank-${field.name}`;
                return (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={id}>{t(field.label)}</Label>
                    <Input
                      id={id}
                      className="min-h-10"
                      autoComplete={field.autoComplete}
                      autoCapitalize={
                        field.name === "accountNumber" || field.name === "swift"
                          ? "characters"
                          : undefined
                      }
                      aria-invalid={Boolean(error)}
                      {...form.register(field.name)}
                    />
                    {error && <p className="text-destructive text-xs">{t(error)}</p>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-10" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("partnerPortal.bankSave")}
              </Button>
              {d && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  onClick={() => {
                    form.reset();
                    setEditing(false);
                  }}
                >
                  {t("partnerPortal.bankCancel")}
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
