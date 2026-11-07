"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSalesPageLanding, suggestReferralCode, type PartnerDealFormValues } from "../lib/partner-form";

export interface SalesPageOption {
  page: string;
  /** The partner who already owns it, if any (then it can't be picked). */
  ownedBy: string | null;
}

const pageLabel = (page: string, label: string) => label.replace("{n}", page.replace("sales-page-", ""));

/**
 * The deal's fields, shared by "New referral partner" and "Edit deal".
 *
 * "Link opens" is where the partner's link goes: the sign-up page or the home
 * page (a referral link: code + customer discount), or, when `salesPageOptions`
 * is given (creating), a sales page they own (no code, no discount, counted
 * from a date). With `autoCode`, the code follows the name until it's typed.
 */
export function PartnerDealFields({
  form,
  salesPageOptions,
  autoCode = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  salesPageOptions?: SalesPageOption[];
  autoCode?: boolean;
}) {
  const { t } = useI18n();
  const f = form as UseFormReturn<PartnerDealFormValues>;
  const landing = f.watch("referralLanding");
  const displayName = f.watch("displayName");
  const salesPage = isSalesPageLanding(landing ?? "");

  // The code follows the name until the admin types one of their own.
  const codeTouched = useRef(false);
  useEffect(() => {
    if (!autoCode || codeTouched.current || salesPage) return;
    f.setValue("referralCode", suggestReferralCode(displayName ?? ""), { shouldValidate: false });
  }, [autoCode, displayName, salesPage, f]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField
        control={f.control}
        name="displayName"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>{t("adminPages.partners.deal.name")}</FormLabel>
            <FormControl>
              <Input placeholder="Bob" autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={f.control}
        name="referralLanding"
        render={({ field }) => (
          <FormItem className={salesPage ? "" : "sm:col-span-1"}>
            <FormLabel>{t("adminPages.partners.deal.linkOpens")}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{t("adminPages.partners.deal.referralGroup")}</SelectLabel>
                  <SelectItem value="REGISTER">{t("adminPages.partners.deal.register")}</SelectItem>
                  <SelectItem value="HOME">{t("adminPages.partners.deal.home")}</SelectItem>
                </SelectGroup>
                {salesPageOptions && salesPageOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{t("adminPages.partners.deal.salesGroup")}</SelectLabel>
                    {salesPageOptions.map((o) => (
                      <SelectItem key={o.page} value={o.page} disabled={Boolean(o.ownedBy)}>
                        {pageLabel(o.page, t("adminPages.partners.salesPage"))}
                        {o.ownedBy ? t("adminPages.partners.deal.ownedBy").replace("{name}", o.ownedBy) : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {salesPage ? (
        <FormField
          control={f.control}
          name="creditFrom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("adminPages.partners.deal.countFrom")}</FormLabel>
              <FormControl>
                <Input type="date" className="min-h-10" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <FormField
          control={f.control}
          name="referralCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("adminPages.partners.deal.code")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="BOB"
                  autoComplete="off"
                  autoCapitalize="characters"
                  {...field}
                  onChange={(e) => {
                    codeTouched.current = true;
                    field.onChange(e.target.value.toUpperCase());
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={f.control}
        name="commissionRate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("adminPages.partners.deal.commission")}</FormLabel>
            <FormControl>
              <Input inputMode="decimal" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={f.control}
        name="commissionMonths"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("adminPages.partners.deal.months")}</FormLabel>
            <FormControl>
              <Input inputMode="numeric" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {!salesPage && (
        <FormField
          control={f.control}
          name="customerDiscountPercent"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t("adminPages.partners.deal.discount")}</FormLabel>
              <FormControl>
                <Input inputMode="decimal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={f.control}
        name="notes"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>{t("adminPages.partners.deal.notes")}</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                placeholder={t("adminPages.partners.deal.notesPlaceholder")}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
