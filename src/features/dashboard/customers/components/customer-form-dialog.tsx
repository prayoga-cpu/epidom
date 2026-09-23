"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import type { CustomerRowDto } from "@/types/api/cashier";
import { useCreateCustomer, useUpdateCustomer } from "../hooks/use-customer-mutations";
import {
  createCustomerFormSchema,
  customerToFormValues,
  defaultPhoneCountry,
  emptyCustomerForm,
  toCreateBody,
  toUpdateBody,
  type CustomerFormValues,
} from "../lib/customer-schemas";

const FORM_ID = "customer-form";

interface CustomerFormDialogProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer being edited, or null to add a new one. */
  customer: CustomerRowDto | null;
}

/**
 * Add / edit a customer. Unlike the optimistic-close dialogs elsewhere, this one
 * stays open until the server says yes: a duplicate or malformed phone comes
 * back as a field error, and closing first would throw the error (and the
 * cashier's typing) away.
 */
export function CustomerFormDialog({
  storeId,
  open,
  onOpenChange,
  customer,
}: CustomerFormDialogProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const createCustomer = useCreateCustomer(storeId);
  const updateCustomer = useUpdateCustomer(storeId);
  const isEditing = customer !== null;
  const isPending = createCustomer.isPending || updateCustomer.isPending;

  const schema = useMemo(() => createCustomerFormSchema(t), [t]);
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: customer ? customerToFormValues(customer) : emptyCustomerForm(),
  });

  // Re-seed on each open (and if the dialog is pointed at another customer) so a
  // cancelled edit or a previous server error never leaks into the next session.
  // Not keyed on `customer` itself: a background refetch replaces that object
  // and would wipe what the user is typing.
  useEffect(() => {
    if (open) form.reset(customer ? customerToFormValues(customer) : emptyCustomerForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  const handleOpenChange = (next: boolean) => {
    // Mid-request the outcome (and its error) still has to land somewhere.
    if (!next && isPending) return;
    onOpenChange(next);
  };

  async function onSubmit(values: CustomerFormValues) {
    try {
      const saved = customer
        ? await updateCustomer.mutateAsync({
            customerId: customer.id,
            body: toUpdateBody(values),
          })
        : await createCustomer.mutateAsync(toCreateBody(values));
      const key = isEditing ? "customers.form.toasts.updated" : "customers.form.toasts.added";
      toast.success(t(key).replace("{name}", saved.name));
      onOpenChange(false);
    } catch (error) {
      // 409 duplicate phone / 400 bad phone arrive as [{ field, message }] and are
      // shown under the offending input. Anything else is a toast.
      const fieldSummary = applyServerFieldErrors(form, error);
      if (!fieldSummary) {
        toast.error(error instanceof Error ? error.message : t("customers.form.toasts.failed"));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FormDialogLayout
        title={isEditing ? t("customers.form.editTitle") : t("customers.form.addTitle")}
        description={
          isEditing ? t("customers.form.editDescription") : t("customers.form.addDescription")
        }
        maxWidth="md"
        // FormDialogFooter's buttons are the shared h-9; lift them to the 40px
        // touch minimum for this dialog without forking the shared footer.
        className="[&_[data-slot=dialog-footer]_button]:h-10"
        footer={
          <FormDialogFooter
            formId={FORM_ID}
            onCancel={() => handleOpenChange(false)}
            cancelText={t("customers.form.cancel")}
            submitText={isEditing ? t("customers.form.save") : t("customers.form.add")}
            isPending={isPending}
          />
        }
      >
        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("customers.form.name")}</FormLabel>
                  <FormControl>
                    <Input
                      className="h-10"
                      autoComplete="off"
                      placeholder={t("customers.form.namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("customers.form.phone")}</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      defaultCountry={defaultPhoneCountry(currency)}
                    />
                  </FormControl>
                  <FormDescription>{t("customers.form.phoneHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("customers.form.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      className="h-10"
                      autoComplete="off"
                      placeholder={t("customers.form.emailPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("customers.form.notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={t("customers.form.notesPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
