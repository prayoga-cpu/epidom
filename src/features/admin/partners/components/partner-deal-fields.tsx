"use client";

import { useEffect, useRef } from "react";
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

const pageLabel = (page: string) => page.replace("sales-page-", "Sales page ");

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
            <FormLabel>Partner name (shown on their banner and page)</FormLabel>
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
            <FormLabel>Link opens</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Referral link (customers get the discount)</SelectLabel>
                  <SelectItem value="REGISTER">Sign-up page (/register)</SelectItem>
                  <SelectItem value="HOME">Home page</SelectItem>
                </SelectGroup>
                {salesPageOptions && salesPageOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>A sales page they own (every sign-up from it counts)</SelectLabel>
                    {salesPageOptions.map((o) => (
                      <SelectItem key={o.page} value={o.page} disabled={Boolean(o.ownedBy)}>
                        {pageLabel(o.page)}
                        {o.ownedBy ? ` (owned by ${o.ownedBy})` : ""}
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
              <FormLabel>Count sign-ups from</FormLabel>
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
              <FormLabel>Referral code</FormLabel>
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
            <FormLabel>Commission (%)</FormLabel>
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
            <FormLabel>For the customer&apos;s first … months</FormLabel>
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
              <FormLabel>Customer discount on the first payment (%)</FormLabel>
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
            <FormLabel>Notes (admin only)</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                placeholder="The agreement, how they're paid (no bank details here)"
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
