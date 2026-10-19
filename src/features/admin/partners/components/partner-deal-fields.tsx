"use client";

import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartnerDealFormValues } from "../lib/partner-form";

/**
 * The deal's fields, shared by "New partner" and "Edit deal". Typed loosely on
 * the form so both the create values (with email) and the edit values fit.
 */
export function PartnerDealFields({
  form,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}) {
  const f = form as UseFormReturn<PartnerDealFormValues>;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField
        control={f.control}
        name="displayName"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Name on the referral banner</FormLabel>
            <FormControl>
              <Input placeholder="Bob" autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={f.control}
        name="referralCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Referral code</FormLabel>
            <FormControl>
              <Input
                placeholder="BOB (empty = no link)"
                autoComplete="off"
                autoCapitalize="characters"
                {...field}
                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={f.control}
        name="referralLanding"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Link opens</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="REGISTER">Sign-up page (/register)</SelectItem>
                <SelectItem value="HOME">Home page</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
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
      <FormField
        control={f.control}
        name="customerDiscountPercent"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Customer discount on the first payment (%), referral link only</FormLabel>
            <FormControl>
              <Input inputMode="decimal" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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
