"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SALES_PAGES } from "@/lib/sales-pages";
import { PLAN_LABELS, type PlanTier } from "@/lib/plans/entitlements";
import type { getPartnerDetail } from "@/lib/services/partner.service";
import { referralLink } from "@/features/referrals/lib/links";
import {
  apiJson,
  partnerDealFormSchema,
  toDealPayload,
  type PartnerDealFormValues,
  todayIso,
} from "../lib/partner-form";
import { PartnerDealFields } from "./partner-deal-fields";
import { CurrencyTotalsList, StatusBadge, money, shortDate } from "./partner-bits";
import { PARTNERS_QUERY_KEY } from "./partners-admin";

type Detail = Awaited<ReturnType<typeof getPartnerDetail>>;

const STATUS_TEXT: Record<string, string> = {
  FREE: "Free",
  CHECKOUT: "Checkout not finished",
  TRIAL: "Trial",
  ACTIVE: "Paying",
  PAST_DUE: "Payment failed",
  CANCELED: "Canceled",
  GRANTED: "Granted by admin",
};

const today = () => new Date().toISOString().slice(0, 10);

function useOrigin(): string {
  const [origin, setOrigin] = useState("https://epidom.fr");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function EditDealDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: Detail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const p = detail.partner;
  const form = useForm<PartnerDealFormValues>({
    resolver: zodResolver(partnerDealFormSchema),
    values: {
      displayName: p.displayName,
      referralCode: p.referralCode ?? "",
      referralLanding: p.referralLanding,
      creditFrom: todayIso(),
      commissionRate: String(Number(p.commissionRate)),
      commissionMonths: String(p.commissionMonths),
      customerDiscountPercent: String(Number(p.customerDiscountPercent)),
      notes: p.notes ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (values: PartnerDealFormValues) =>
      apiJson(`/api/admin/partners/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify(toDealPayload(values)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner", p.id] });
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      toast.success("Deal updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit deal</DialogTitle>
          <DialogDescription>
            Changes apply to new sign-ups only. Customers who already signed up keep the deal they
            signed up with, including the discount the banner promised them.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-0.5 pb-1">
              <PartnerDealFields form={form} />
            </div>
            <DialogFooter className="shrink-0 pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SalesPagesCard({ detail }: { detail: Detail }) {
  const queryClient = useQueryClient();
  const p = detail.partner;
  const initial = useMemo(
    () => Object.fromEntries(p.salesPages.map((s) => [s.page, s.creditFrom.slice(0, 10)])),
    [p.salesPages]
  );
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  useEffect(() => setDraft(initial), [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const save = useMutation({
    mutationFn: () =>
      apiJson<{ credited: number }>(`/api/admin/partners/${p.id}/sales-pages`, {
        method: "PUT",
        body: JSON.stringify({
          pages: Object.entries(draft).map(([page, creditFrom]) => ({
            page,
            creditFrom: `${creditFrom}T00:00:00Z`,
          })),
        }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner", p.id] });
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      toast.success(
        res.credited > 0
          ? `Sales pages saved · ${res.credited} earlier sign-up${res.credited === 1 ? "" : "s"} credited`
          : "Sales pages saved"
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sales pages owned</CardTitle>
        <p className="text-muted-foreground text-xs">
          Every sign-up from an owned page (French, English and Indonesian) since its &quot;credit
          from&quot; date earns this partner commission. No customer discount on sales pages. A page
          has one owner.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {SALES_PAGES.map((page) => {
          const checked = page in draft;
          const id = `owned-${page}`;
          return (
            <div key={page} className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={id}
                className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(v) =>
                    setDraft((d) => {
                      const next = { ...d };
                      if (v === true) next[page] = next[page] ?? today();
                      else delete next[page];
                      return next;
                    })
                  }
                />
                {page.replace("sales-page-", "Sales page ")}
              </label>
              {checked && (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`${id}-from`} className="text-muted-foreground text-xs">
                    Credit from
                  </Label>
                  <Input
                    id={`${id}-from`}
                    type="date"
                    className="h-10 w-40"
                    value={draft[page]}
                    onChange={(e) => setDraft((d) => ({ ...d, [page]: e.target.value || today() }))}
                  />
                </div>
              )}
            </div>
          );
        })}
        <div className="pt-2">
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className="min-h-10"
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save sales pages
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Where to transfer: the partner enters it on their page. Full admins see it to pay. */
function BankDetailsAdminCard({ detail, canPay }: { detail: Detail; canPay: boolean }) {
  const p = detail.partner;
  const view = p.bankDetails;
  const d = view?.details ?? null;
  const copy = (value: string) =>
    navigator.clipboard.writeText(value).then(() => toast.success("Copied"));
  return (
    <Card className={!p.bankDetailsSet ? "border-amber-500/40" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Payout details</CardTitle>
        <p className="text-muted-foreground text-xs">
          Entered by the partner on their page, stored encrypted.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!p.bankDetailsSet ? (
          <p className="text-amber-500">
            Not provided yet: {p.displayName} adds them on their partner page.
          </p>
        ) : !canPay ? (
          <p className="text-muted-foreground">Provided. Only a full admin sees them.</p>
        ) : !d ? (
          <p className="text-amber-500">
            Saved, but they can&apos;t be read here (encrypted in another environment). Ask the
            partner to enter them again if this is production.
          </p>
        ) : (
          <>
            {(
              [
                ["Account holder", d.accountHolder],
                ["Bank", d.bankName],
                ["IBAN / account number", d.accountNumber],
                ...(d.swift ? [["BIC / SWIFT", d.swift]] : []),
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="text-foreground break-all tabular-nums">{value}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-10 shrink-0"
                  aria-label={`Copy ${label}`}
                  onClick={() => copy(value)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {view?.updatedAt && (
              <p className="text-muted-foreground text-xs">Updated {shortDate(view.updatedAt)}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PayoutDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: Detail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const payable = detail.totals.filter((t) => Number(t.ready) > 0);
  const [currency, setCurrency] = useState(payable[0]?.currency ?? "");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  useEffect(() => {
    if (open) {
      setCurrency(payable[0]?.currency ?? "");
      setReference("");
      setPaidAt(today());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const amount = payable.find((t) => t.currency === currency)?.ready;

  const record = useMutation({
    mutationFn: () =>
      apiJson(`/api/admin/partners/${detail.partner.id}/payouts`, {
        method: "POST",
        body: JSON.stringify({
          currency,
          reference: reference || null,
          paidAt: `${paidAt}T12:00:00Z`,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner", detail.partner.id] });
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      toast.success("Payout recorded");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payout</DialogTitle>
          <DialogDescription>
            After you&apos;ve sent the bank transfer: everything ready to pay in this currency is
            marked paid. The amount is the sum of those commissions, refunds already taken off.
          </DialogDescription>
        </DialogHeader>
        {payable.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing is ready to pay yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {payable.map((t) => (
                    <SelectItem key={t.currency} value={t.currency}>
                      {t.currency.toUpperCase()} · {money(t.ready, t.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-ref">Bank transfer reference</Label>
              <Input
                id="payout-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-date">Paid on</Label>
              <Input
                id="payout-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            {amount && (
              <p className="text-foreground text-sm">
                Amount: <strong>{money(amount, currency)}</strong>
              </p>
            )}
            {detail.partner.bankDetails?.details ? (
              <p className="text-muted-foreground text-sm">
                Transfer to <strong>{detail.partner.bankDetails.details.accountHolder}</strong>,{" "}
                {detail.partner.bankDetails.details.bankName},{" "}
                <span className="tabular-nums">{detail.partner.bankDetails.details.accountNumber}</span>
                {detail.partner.bankDetails.details.swift
                  ? ` (${detail.partner.bankDetails.details.swift})`
                  : ""}
              </p>
            ) : (
              <p className="text-sm text-amber-500">
                {detail.partner.displayName} hasn&apos;t entered their bank details yet.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!amount || record.isPending} onClick={() => record.mutate()}>
            {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record payout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PartnerDetail({ partnerId, canPay }: { partnerId: string; canPay: boolean }) {
  const queryClient = useQueryClient();
  const origin = useOrigin();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ["admin-partner", partnerId],
    queryFn: () => apiJson(`/api/admin/partners/${partnerId}`),
  });

  const setStatus = useMutation({
    mutationFn: (status: "ACTIVE" | "PAUSED" | "ENDED") =>
      apiJson(`/api/admin/partners/${partnerId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner", partnerId] });
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: () => apiJson(`/api/admin/partners/${partnerId}/invite`, { method: "POST" }),
    onSuccess: () => toast.success("Invitation sent again (the previous link no longer works)"),
    onError: (e: Error) => toast.error(e.message),
  });

  const voidRow = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiJson(`/api/admin/partners/commissions/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner", partnerId] });
      toast.success("Commission voided");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground px-4 py-6 text-sm sm:px-6">Loading…</p>;
  if (error || !data) {
    return (
      <p className="px-4 py-6 text-sm text-red-400 sm:px-6">
        {(error as Error)?.message ?? "Not found"}
      </p>
    );
  }
  const p = data.partner;
  const link = p.referralCode ? referralLink(origin, p.referralCode, p.referralLanding) : null;

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="min-h-10">
            <Link href="/admin/partners">
              <ArrowLeft className="mr-1 h-4 w-4" /> Partners
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-foreground flex items-center gap-2 text-lg font-bold">
              {p.displayName} <StatusBadge status={p.status} />
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {p.user?.email ??
                (p.inviteEmail ? `Invited: ${p.inviteEmail} (not joined yet)` : "Account deleted")}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {!p.user && p.inviteEmail && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                disabled={resend.isPending}
                onClick={() => resend.mutate()}
              >
                {resend.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Resend invitation
              </Button>
            )}
            {p.status !== "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => setStatus.mutate("ACTIVE")}
              >
                Resume
              </Button>
            )}
            {p.status === "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => setStatus.mutate("PAUSED")}
              >
                Pause
              </Button>
            )}
            {p.status !== "ENDED" && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 text-red-400"
                onClick={() => {
                  if (
                    window.confirm(
                      "End this partner? New sign-ups stop counting and their link stops giving the discount. Existing customers finish their window."
                    )
                  ) {
                    setStatus.mutate("ENDED");
                  }
                }}
              >
                End
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Deal</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit deal
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <strong>{Number(p.commissionRate)}%</strong> of what each customer pays during their
                first <strong>{p.commissionMonths}</strong> month
                {p.commissionMonths === 1 ? "" : "s"} of paid billing (a yearly plan counts{" "}
                {p.commissionMonths}/12 of the year).
              </p>
              {p.referralCode ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    Referral link · customers get{" "}
                    <strong>{Number(p.customerDiscountPercent)}%</strong> off their first payment
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted/50 min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">
                      {link}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      onClick={() =>
                        link &&
                        navigator.clipboard.writeText(link).then(() => toast.success("Copied"))
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No referral link (sales pages only).
                </p>
              )}
              {p.notes && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap">{p.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Commission</CardTitle>
              {canPay && (
                <Button size="sm" className="min-h-10" onClick={() => setPaying(true)}>
                  Record payout
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              <CurrencyTotalsList totals={data.totals} />
              <p className="text-muted-foreground text-[11px]">
                Each commission is on hold for 30 days after the payment, in case it&apos;s
                refunded.
                {!canPay && " Payouts are recorded by a full admin."}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SalesPagesCard detail={data} />
          <BankDetailsAdminCard detail={data} canPay={canPay} />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Customers ({data.customers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.customers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sign-ups credited yet.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">Signed up</th>
                      <th className="px-2 py-2 font-medium">Customer</th>
                      <th className="px-2 py-2 font-medium">Came from</th>
                      <th className="px-2 py-2 font-medium">Ad</th>
                      <th className="px-2 py-2 font-medium">Plan</th>
                      <th className="px-2 py-2 font-medium">Window ends</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-2">Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {data.customers.map((c) => (
                      <tr key={c.userId}>
                        <td className="px-4 py-2 whitespace-nowrap sm:px-2">
                          {shortDate(c.signedUpAt)}
                        </td>
                        <td className="px-2 py-2">
                          <p className="text-foreground">{c.label ?? "New sign-up"}</p>
                          <p className="text-muted-foreground text-xs">{c.email}</p>
                          {c.selfReferralFlag && (
                            <p className="text-xs text-red-400">Same IP as the partner: check it</p>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {c.source === "REFERRAL_LINK"
                            ? `Link${c.discountPercent ? ` · ${Number(c.discountPercent)}% off${c.discountRedeemed ? " (used)" : ""}` : ""}`
                            : (c.salesPage?.replace("sales-page-", "Sales page ") ?? "—")}
                        </td>
                        <td className="px-2 py-2">
                          {[c.utmSource, c.utmCampaign].filter(Boolean).join(" / ") ||
                            (c.adClick ? `${c.adClick} ad` : "—")}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {PLAN_LABELS[c.plan as PlanTier] ?? c.plan}{" "}
                          <span className="text-muted-foreground text-xs">
                            · {STATUS_TEXT[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{shortDate(c.windowEnd)}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums sm:px-2">
                          {c.earned.length === 0
                            ? "—"
                            : c.earned.map((e) => money(e.amount, e.currency)).join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {data.ledger.length === 0 ? (
              <p className="text-muted-foreground text-sm">No commission yet.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-xs">
                      <th className="px-4 py-2 font-medium sm:px-2">Paid on</th>
                      <th className="px-2 py-2 font-medium">Customer</th>
                      <th className="px-2 py-2 font-medium">Payment</th>
                      <th className="px-2 py-2 font-medium">Counts</th>
                      <th className="px-2 py-2 text-right font-medium">Commission</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 sm:px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {data.ledger.map((r) => (
                      <tr key={r.id} className={r.status === "VOID" ? "opacity-50" : undefined}>
                        <td className="px-4 py-2 whitespace-nowrap sm:px-2">
                          {shortDate(r.earnedAt)}
                        </td>
                        <td className="px-2 py-2">
                          {r.customerLabel ??
                            (r.customerDeleted ? "Deleted account" : "New sign-up")}
                          {r.note && <p className="text-muted-foreground text-xs">{r.note}</p>}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                          {money(r.invoiceAmount, r.currency)}
                          {r.plan && (
                            <span className="text-muted-foreground text-xs">
                              {" "}
                              · {PLAN_LABELS[r.plan as PlanTier] ?? r.plan}
                              {r.billingInterval === "YEARLY" ? " yearly" : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                          {r.kind === "INVOICE"
                            ? `${money(r.commissionableAmount, r.currency)} × ${Number(r.rate)}%`
                            : "Refund"}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                          {money(r.amount, r.currency)}
                        </td>
                        <td className="px-2 py-2 text-xs whitespace-nowrap">
                          {r.status === "PAID"
                            ? "Paid"
                            : r.status === "VOID"
                              ? "Void"
                              : r.ready
                                ? "Ready to pay"
                                : `On hold until ${shortDate(r.payableAt)}`}
                        </td>
                        <td className="px-4 py-2 text-right sm:px-2">
                          {canPay && r.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-10 text-red-400"
                              disabled={voidRow.isPending}
                              onClick={() => {
                                const reason = window.prompt("Why void this commission?");
                                if (reason?.trim())
                                  voidRow.mutate({ id: r.id, reason: reason.trim() });
                              }}
                            >
                              Void
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            {data.payouts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No payouts yet.</p>
            ) : (
              <div className="divide-border divide-y text-sm">
                {data.payouts.map((po) => (
                  <div
                    key={po.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>{shortDate(po.paidAt)}</span>
                    <span className="text-muted-foreground text-xs">
                      {po.reference ?? "No reference"}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {money(po.amount, po.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <EditDealDialog detail={data} open={editing} onOpenChange={setEditing} />
      {canPay && <PayoutDialog detail={data} open={paying} onOpenChange={setPaying} />}
    </div>
  );
}
