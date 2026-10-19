"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SALES_PAGES } from "@/lib/sales-pages";
import type { PartnerListRow } from "@/lib/services/partner.service";
import {
  DEFAULT_DEAL,
  apiJson,
  createPartnerFormSchema,
  suggestReferralCode,
  toDealPayload,
  type CreatePartnerFormValues,
} from "../lib/partner-form";
import { PartnerDealFields } from "./partner-deal-fields";
import { CurrencyTotalsList, StatusBadge } from "./partner-bits";

export const PARTNERS_QUERY_KEY = ["admin-partners"] as const;

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Make an Epidom account a referral partner: their deal and, in the same
 * step, the sales pages they own. Opened from this page or from a user's
 * menu in the users list (with their email filled in).
 */
export function NewPartnerDialog({
  open,
  onOpenChange,
  initialEmail = "",
  initialName = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialEmail?: string;
  initialName?: string;
}) {
  const queryClient = useQueryClient();
  const form = useForm<CreatePartnerFormValues>({
    resolver: zodResolver(createPartnerFormSchema),
    defaultValues: { ...DEFAULT_DEAL, email: initialEmail, displayName: initialName },
  });
  const [ownedPages, setOwnedPages] = useState<string[]>([]);
  const [creditFrom, setCreditFrom] = useState(todayIso());
  useEffect(() => {
    if (!open) return;
    form.reset({
      ...DEFAULT_DEAL,
      email: initialEmail,
      displayName: initialName,
      // No code unless the admin adds one: a sales-page owner has no link.
      referralCode: "",
    });
    setOwnedPages([]);
    setCreditFrom(todayIso());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEmail, initialName]);

  const create = useMutation({
    mutationFn: async (values: CreatePartnerFormValues) => {
      const { partner } = await apiJson<{ partner: { id: string } }>("/api/admin/partners", {
        method: "POST",
        body: JSON.stringify({
          ...toDealPayload(values),
          email: values.email.trim().toLowerCase(),
        }),
      });
      if (ownedPages.length > 0) {
        await apiJson(`/api/admin/partners/${partner.id}/sales-pages`, {
          method: "PUT",
          body: JSON.stringify({
            pages: ownedPages.map((page) => ({ page, creditFrom: `${creditFrom}T00:00:00Z` })),
          }),
        });
      }
      return partner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Referral partner created");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      // The partner may exist with its pages not saved: the list shows what was kept.
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      toast.error(e.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>New referral partner</DialogTitle>
          <DialogDescription>
            The partner needs an Epidom account. They get their own page (Partner dashboard in their
            account menu) with their link, the report of their sales pages and their commission, and
            nothing else of the admin panel.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => create.mutate(v))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5 pb-1">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Their Epidom account email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="off"
                        placeholder="bob@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <PartnerDealFields form={form} />
              <div className="space-y-2 rounded-lg border border-sky-500/20 p-3">
                <p className="text-foreground text-sm font-medium">Sales pages they own</p>
                <p className="text-muted-foreground text-xs">
                  Every sign-up from these pages (all languages) counts for them. Leave empty for a
                  referral link only. A page already owned by someone else is refused.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {SALES_PAGES.map((page) => (
                    <label
                      key={page}
                      className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={ownedPages.includes(page)}
                        onCheckedChange={(v) =>
                          setOwnedPages((list) =>
                            v === true
                              ? [...new Set([...list, page])]
                              : list.filter((p) => p !== page)
                          )
                        }
                      />
                      {page.replace("sales-page-", "Sales page ")}
                    </label>
                  ))}
                </div>
                {ownedPages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Label
                      htmlFor="new-partner-credit-from"
                      className="text-muted-foreground text-xs"
                    >
                      Count sign-ups from
                    </Label>
                    <Input
                      id="new-partner-credit-from"
                      type="date"
                      className="h-10 w-40"
                      value={creditFrom}
                      onChange={(e) => setCreditFrom(e.target.value || todayIso())}
                    />
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10"
                onClick={() => {
                  const name = form.getValues("displayName");
                  if (name)
                    form.setValue("referralCode", suggestReferralCode(name), {
                      shouldValidate: true,
                    });
                }}
              >
                Suggest a code from the name
              </Button>
            </div>
            <DialogFooter className="shrink-0 pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create referral partner
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function PartnersAdmin() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error } = useQuery<{ partners: PartnerListRow[] }>({
    queryKey: PARTNERS_QUERY_KEY,
    queryFn: () => apiJson("/api/admin/partners"),
  });
  const partners = data?.partners ?? [];

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
            <Handshake className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-foreground text-lg font-bold">Referrals</h1>
            <p className="text-muted-foreground text-xs">
              Referral partners: their links, the sales pages they own, and their commission
            </p>
          </div>
          <Button className="ml-auto min-h-10" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New referral partner
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{(error as Error).message}</p>
        ) : partners.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              No referral partners yet. Create one here, or from a user in the users list, to give
              them a referral link or a sales page.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {partners.map((p) => (
              <Link key={p.id} href={`/admin/partners/${p.id}`} className="group block">
                <Card className="h-full transition-colors group-hover:border-amber-500/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{p.displayName}</CardTitle>
                        <p className="text-muted-foreground truncate text-xs">
                          {p.user?.email ?? "Account deleted"}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {p.referralCode && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-300">
                          ?ref={p.referralCode}
                        </span>
                      )}
                      {p.salesPages.map((s) => (
                        <span
                          key={s.page}
                          className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-300"
                        >
                          {s.page.replace("sales-page-", "Sales page ")}
                        </span>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {p.commissionRate}% for {p.commissionMonths} month
                      {p.commissionMonths === 1 ? "" : "s"}
                      {p.referralCode && Number(p.customerDiscountPercent) > 0
                        ? ` · customers get ${p.customerDiscountPercent}% off the first payment`
                        : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/40 rounded-md p-2">
                        <p className="text-muted-foreground text-[11px]">Sign-ups</p>
                        <p className="text-foreground font-semibold tabular-nums">{p.signups}</p>
                      </div>
                      <div className="bg-muted/40 rounded-md p-2">
                        <p className="text-muted-foreground text-[11px]">Paid at least once</p>
                        <p className="text-foreground font-semibold tabular-nums">
                          {p.payingCustomers}
                        </p>
                      </div>
                    </div>
                    <CurrencyTotalsList totals={p.totals} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <NewPartnerDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
