"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";
import { PaymentTerms } from "@/types/entities";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";

// Zod validation schema
const supplierSchema = z.object({
  name: z.string().min(2, "Supplier name must be at least 2 characters"),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  paymentTerms: z.nativeEnum(PaymentTerms).optional(),
  deliverySchedule: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).optional().or(z.literal(0)),
  notes: z.string().optional(),
  onTimeDeliveryRate: z.coerce.number().min(0).max(100).optional().or(z.literal(0)),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface AddSupplierDialogProps {
  children?: React.ReactNode;
}

export default function AddSupplierDialog({ children }: AddSupplierDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      paymentTerms: undefined,
      deliverySchedule: "",
      rating: 0,
      notes: "",
      onTimeDeliveryRate: 0,
    },
  });

  const onSubmit = async (data: SupplierFormValues) => {
    setIsSubmitting(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: Replace with actual API call
    // const response = await fetch("/api/suppliers", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     ...data,
    //     storeId: "STORE-001", // Get from context/session
    //   }),
    // });

    console.log("Supplier data to submit:", data);

    setIsSubmitting(false);
    toast({
      title: "Supplier Added Successfully",
      description: `${data.name} has been added to your suppliers.`,
    });

    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("common.actions.add") || "Add Supplier"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{t("data.suppliers.addTitle") || "Add New Supplier"}</DialogTitle>
          <DialogDescription>
            Add a new supplier to your contact list. Fill in as much information as possible.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name *</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.suppliers.form.contactPersonPlaceholder")} {...field} />
                      </FormControl>
                      <FormDescription>Primary contact name</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t("data.suppliers.form.emailPlaceholder")} {...field} />
                      </FormControl>
                      <FormDescription>Business email</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.phonePlaceholder")} {...field} />
                    </FormControl>
                    <FormDescription>Business phone number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Address</h3>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.addressPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.suppliers.form.cityPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.suppliers.form.countryPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Business Terms */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Business Terms</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.suppliers.form.selectPaymentTerms")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PaymentTerms.COD}>Cash on Delivery</SelectItem>
                          <SelectItem value={PaymentTerms.NET15}>Net 15 Days</SelectItem>
                          <SelectItem value={PaymentTerms.NET30}>Net 30 Days</SelectItem>
                          <SelectItem value={PaymentTerms.NET60}>Net 60 Days</SelectItem>
                          <SelectItem value={PaymentTerms.NET90}>Net 90 Days</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Payment deadline</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deliverySchedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Schedule</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.suppliers.form.deliverySchedulePlaceholder")} {...field} />
                      </FormControl>
                      <FormDescription>Regular delivery days</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Performance Metrics (Optional)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quality Rating</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          placeholder={t("data.suppliers.form.ratingPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Rating out of 5.0</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="onTimeDeliveryRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>On-Time Delivery Rate</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          placeholder={t("data.suppliers.form.onTimeDeliveryRatePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Percentage (0-100)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Additional Notes</h3>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.suppliers.form.notesPlaceholder")}
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Special requirements, preferences, or important details
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                {t("actions.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("") || "Add Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
