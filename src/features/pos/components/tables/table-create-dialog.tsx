"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Button } from "@/components/ui/button";

interface TableCreateDialogProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTable?: { id: string; label: string; capacity: number } | null;
}

export function TableCreateDialog({
  storeId,
  open,
  onOpenChange,
  editTable,
}: TableCreateDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!editTable;

  const schema = z.object({
    label: z.string().min(1, t("pos.tables.labelRequired")).max(50),
    capacity: z.coerce.number().int().min(1).max(50),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: editTable?.label ?? "",
      capacity: editTable?.capacity ?? 4,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await apiClient.patch(`/stores/${storeId}/tables/${editTable!.id}`, values);
        toast.success(t("common.actions.saveChanges"));
      } else {
        await apiClient.post(`/stores/${storeId}/tables`, values);
        toast.success(t("pos.tables.add"));
      }
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      onOpenChange(false);
      form.reset();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? t("pos.tables.saveFailed");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("pos.tables.edit") : t("pos.tables.add")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("pos.tables.label")}</FormLabel>
                  <FormControl>
                    <Input placeholder="A1, B2, VIP 1..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("pos.tables.capacityPax")}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={50} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t("common.actions.saving")
                  : isEdit
                    ? t("common.actions.save")
                    : t("common.actions.add")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
