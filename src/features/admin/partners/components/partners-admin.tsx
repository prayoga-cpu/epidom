"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, Loader2, Mail, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
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
import { cn } from "@/lib/utils";
import { SALES_PAGES } from "@/lib/sales-pages";
import type { PartnerListRow } from "@/lib/services/partner.service";
import {
  DEFAULT_DEAL,
  apiJson,
  createPartnerFormSchema,
  todayIso,
  toCreatePayload,
  type CreatePartnerFormValues,
} from "../lib/partner-form";
import { PartnerDealFields, type SalesPageOption } from "./partner-deal-fields";
import { CurrencyTotalsList, StatusBadge } from "./partner-bits";

export const PARTNERS_QUERY_KEY = ["admin-partners"] as const;

interface Candidate {
  id: string;
  name: string | null;
  email: string;
  business: string | null;
}

/** The first name, for the banner ("Bob's referral"). */
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** Search the accounts that can become partners (not partners already). */
function UserPicker({
  selected,
  onSelect,
}: {
  selected: Candidate | null;
  onSelect: (user: Candidate | null) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);
  const { data, isFetching } = useQuery<{ users: Candidate[] }>({
    queryKey: ["admin-partner-candidates", debounced],
    queryFn: () => apiJson(`/api/admin/partners/candidates?q=${encodeURIComponent(debounced)}`),
    enabled: !selected,
  });

  if (selected) {
    return (
      <div className="border-border flex items-center gap-3 rounded-lg border p-3">
        <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{selected.name || selected.email}</p>
          <p className="text-muted-foreground truncate text-xs">
            {selected.email}
            {selected.business ? ` · ${selected.business}` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10"
          aria-label={t("adminPages.partners.picker.chooseOther")}
          onClick={() => onSelect(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const users = data?.users ?? [];
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          className="min-h-10 pl-9"
          placeholder={t("adminPages.partners.picker.search")}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="border-border max-h-56 overflow-y-auto rounded-lg border">
        {isFetching && users.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">{t("adminPages.partners.picker.searching")}</p>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            {t("adminPages.partners.picker.noUser")}
          </p>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u)}
              className="hover:bg-muted/60 flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
            >
              <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="text-foreground block truncate text-sm">{u.name || u.email}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {u.email}
                  {u.business ? ` · ${u.business}` : ""}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Make someone a referral partner: an account picked from the users list, or
 * an email invited to sign up (an email that already has an account is linked
 * straight away). Their link is a referral link (sign-up or home page) or a
 * sales page they own. Opened from the Referrals page, or from a user's Access
 * dialog in the users list (that user picked already).
 */
export function NewPartnerDialog({
  open,
  onOpenChange,
  initialUser = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialUser?: Candidate | null;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<Candidate | null>(initialUser);
  const form = useForm<CreatePartnerFormValues>({
    resolver: zodResolver(createPartnerFormSchema),
    defaultValues: { ...DEFAULT_DEAL, who: "user", userId: "", inviteEmail: "" },
  });
  const who = form.watch("who");

  useEffect(() => {
    if (!open) return;
    setPicked(initialUser);
    form.reset({
      ...DEFAULT_DEAL,
      creditFrom: todayIso(),
      who: "user",
      userId: initialUser?.id ?? "",
      inviteEmail: "",
      displayName: firstName(initialUser?.name),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUser?.id]);

  const { data: partnersData } = useQuery<{ partners: PartnerListRow[] }>({
    queryKey: PARTNERS_QUERY_KEY,
    queryFn: () => apiJson("/api/admin/partners"),
    enabled: open,
  });
  const salesPageOptions: SalesPageOption[] = useMemo(
    () =>
      SALES_PAGES.map((page) => ({
        page,
        ownedBy:
          partnersData?.partners.find((p) => p.salesPages.some((s) => s.page === page))?.displayName ??
          null,
      })),
    [partnersData]
  );

  const create = useMutation({
    mutationFn: (values: CreatePartnerFormValues) =>
      apiJson<{ partner: { id: string }; invited: boolean }>("/api/admin/partners", {
        method: "POST",
        body: JSON.stringify(toCreatePayload(values)),
      }),
    onSuccess: (res, values) => {
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(
        res.invited
          ? t("adminPages.partners.newDialog.invitedToast").replace("{email}", values.inviteEmail.trim())
          : t("adminPages.partners.newDialog.createdToast")
      );
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("adminPages.partners.newDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("adminPages.partners.newDialog.desc")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => create.mutate(v))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5 pb-1">
              {!initialUser && (
                <div className="border-border bg-muted/40 grid grid-cols-2 gap-1 rounded-lg border p-1">
                  {(
                    [
                      ["user", t("adminPages.partners.newDialog.fromUsers"), UserRound],
                      ["invite", t("adminPages.partners.newDialog.inviteByEmail"), Mail],
                    ] as const
                  ).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => form.setValue("who", value, { shouldValidate: false })}
                      className={cn(
                        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md text-xs font-semibold",
                        who === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {who === "user" ? (
                <FormField
                  control={form.control}
                  name="userId"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t("adminPages.partners.newDialog.who")}</FormLabel>
                      <UserPicker
                        selected={picked}
                        onSelect={(u) => {
                          setPicked(u);
                          form.setValue("userId", u?.id ?? "", { shouldValidate: Boolean(u) });
                          if (u && !form.getValues("displayName")) {
                            form.setValue("displayName", firstName(u.name));
                          }
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="inviteEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("adminPages.partners.newDialog.theirEmail")}</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="off" placeholder="bob@example.com" {...field} />
                      </FormControl>
                      <p className="text-muted-foreground text-xs">
                        {t("adminPages.partners.newDialog.emailHint")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <PartnerDealFields form={form} salesPageOptions={salesPageOptions} autoCode />
            </div>
            <DialogFooter className="shrink-0 pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("adminPages.common.cancel")}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {who === "invite" ? t("adminPages.partners.newDialog.sendInvite") : t("adminPages.partners.newDialog.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function PartnersAdmin() {
  const { t } = useI18n();
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
            <h1 className="text-foreground text-lg font-bold">{t("adminPages.partners.list.title")}</h1>
            <p className="text-muted-foreground text-xs">
              {t("adminPages.partners.list.subtitle")}
            </p>
          </div>
          <Button className="ml-auto min-h-10" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("adminPages.partners.list.newPartner")}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">{t("adminPages.partners.list.loading")}</p>
        ) : error ? (
          <p className="text-sm text-red-400">{(error as Error).message}</p>
        ) : partners.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              {t("adminPages.partners.list.empty")}
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
                          {p.user?.email ??
                            (p.inviteEmail
                              ? t("adminPages.partners.list.invited").replace("{email}", p.inviteEmail)
                              : t("adminPages.partners.list.accountDeleted"))}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {!p.bankDetailsSet && p.user && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-500">
                          {t("adminPages.partners.list.noBank")}
                        </span>
                      )}
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
                          {t("adminPages.partners.salesPage").replace("{n}", s.page.replace("sales-page-", ""))}
                        </span>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t(p.commissionMonths === 1 ? "adminPages.partners.list.dealOne" : "adminPages.partners.list.dealMany")
                        .replace("{rate}", String(p.commissionRate))
                        .replace("{months}", String(p.commissionMonths))}
                      {p.referralCode && Number(p.customerDiscountPercent) > 0
                        ? t("adminPages.partners.list.customerDiscount").replace("{percent}", String(p.customerDiscountPercent))
                        : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/40 rounded-md p-2">
                        <p className="text-muted-foreground text-[11px]">{t("adminPages.partners.list.signups")}</p>
                        <p className="text-foreground font-semibold tabular-nums">{p.signups}</p>
                      </div>
                      <div className="bg-muted/40 rounded-md p-2">
                        <p className="text-muted-foreground text-[11px]">{t("adminPages.partners.list.paying")}</p>
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
