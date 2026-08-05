"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/components/lang/i18n-provider";
import { SupplierDelivery, SupplierDeliveryStatus } from "@/types/entities";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils/formatting";
import { CalendarIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUpdateSupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";

interface AddEditDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: SupplierDelivery | null;
}

interface DeliveryItemForm {
  materialId: string;
  quantity: number;
  unit: string;
  notes: string;
}

export function AddEditDeliveryDialog({ open, onOpenChange, delivery }: AddEditDeliveryDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;

  // Fetch materials (used to resolve item names for legacy items without an embedded material)
  const { data: materialsData } = useMaterials(storeId);

  const materials = materialsData?.materials ?? [];

  // Form state
  const [status, setStatus] = useState<SupplierDeliveryStatus>(SupplierDeliveryStatus.PENDING);
  const [expectedDate, setExpectedDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryItemForm[]>([]);

  // Use mutation hook for updating
  const updateMutation = useUpdateSupplierOrder(storeId, delivery?.id || "");

  // Initialize form with delivery data
  useEffect(() => {
    if (delivery) {
      setStatus(delivery.status);
      setExpectedDate(new Date(delivery.expectedDate));
      setNotes(delivery.notes || "");
      setItems(
        delivery.items.map((item) => ({
          materialId: item.materialId,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes || "",
        }))
      );
    }
  }, [delivery, open]);

  const handleItemChange = (
    index: number,
    field: keyof DeliveryItemForm,
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expectedDate) {
      toast({
        title: t("common.validation.error"),
        description: t(
          "management.delivery.dialogs.addEditDelivery.validation.expectedDateRequired"
        ),
        variant: "destructive",
      });
      return;
    }

    if (!delivery) return;

    updateMutation.mutate(
      {
        expectedDate: expectedDate.toISOString(),
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("management.delivery.dialogs.addEditDelivery.editTitle")}
        description={
          t("management.delivery.dialogs.addEditDelivery.editDescription")?.replace(
            "{reference}",
            delivery?.deliveryReference || ""
          ) || ""
        }
        maxWidth="2xl"
        footer={
          <FormDialogFooter
            formId="add-edit-delivery-form"
            onCancel={() => onOpenChange(false)}
            submitText={
              updateMutation.isPending
                ? t("management.delivery.dialogs.addEditDelivery.updating")
                : t("management.delivery.dialogs.addEditDelivery.updateDelivery")
            }
            isPending={updateMutation.isPending}
          />
        }
      >
        <form id="add-edit-delivery-form" onSubmit={handleSubmit} className="space-y-1">
          {/* Delivery Reference */}
          <div className="space-y-2">
            <Label htmlFor="deliveryReference">
              {t("management.delivery.dialogs.addEditDelivery.deliveryReference")} *
            </Label>
            <Input id="deliveryReference" value={delivery?.deliveryReference ?? ""} disabled />
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label htmlFor="supplier">
              {t("management.delivery.dialogs.addEditDelivery.supplier")} *
            </Label>
            <Input id="supplier" value={delivery?.supplier?.name ?? ""} disabled />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">
              {t("management.delivery.dialogs.addEditDelivery.status")} *
            </Label>
            <Select value={status} disabled>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SupplierDeliveryStatus.PENDING}>
                  {t("management.delivery.status.pending")}
                </SelectItem>
                <SelectItem value={SupplierDeliveryStatus.IN_TRANSIT}>
                  {t("management.delivery.status.inTransit")}
                </SelectItem>
                <SelectItem value={SupplierDeliveryStatus.RECEIVED}>
                  {t("management.delivery.status.received")}
                </SelectItem>
                <SelectItem value={SupplierDeliveryStatus.CANCELLED}>
                  {t("management.delivery.status.cancelled")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Use "Update Status" button to change delivery status
            </p>
          </div>

          {/* Expected Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedDate">
              {t("management.delivery.dialogs.addEditDelivery.expectedDate")} *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="expectedDate"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-1 hidden h-4 w-4 sm:inline" />
                  {expectedDate
                    ? formatDate(expectedDate)
                    : t("management.delivery.dialogs.addEditDelivery.selectExpectedDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expectedDate}
                  onSelect={setExpectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Items Section */}
          <div className="space-y-2">
            <Label>{t("management.delivery.dialogs.addEditDelivery.items")} *</Label>
            <p className="text-muted-foreground text-xs">
              Items cannot be modified after delivery creation
            </p>

            {items.length === 0 ? (
              <div className="bg-muted/30 rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  {t("management.delivery.dialogs.addEditDelivery.noItemsYet")}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("management.delivery.dialogs.addEditDelivery.material")}
                      </TableHead>
                      <TableHead className="w-[120px]">
                        {t("management.delivery.dialogs.addEditDelivery.quantity")}
                      </TableHead>
                      <TableHead className="w-[100px]">
                        {t("management.delivery.dialogs.addEditDelivery.unit")}
                      </TableHead>
                      <TableHead>
                        {t("management.delivery.dialogs.addEditDelivery.notes")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => {
                      const material =
                        delivery?.items.find((i) => i.materialId === item.materialId)?.material ??
                        materials.find((m) => m.id === item.materialId);
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <span className="text-sm">
                              {material?.name || t("data.materials.unknownMaterial")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DecimalInput
                              decimals={3}
                              min={0}
                              value={item.quantity}
                              onChange={(value) => handleItemChange(index, "quantity", value ?? 0)}
                              className="h-9"
                              disabled
                            />
                          </TableCell>
                          <TableCell>
                            <Input value={item.unit} className="h-9" disabled />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.notes}
                              onChange={(e) => handleItemChange(index, "notes", e.target.value)}
                              placeholder={t(
                                "management.delivery.dialogs.addEditDelivery.optionalNotes"
                              )}
                              className="h-9"
                              disabled
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t("management.delivery.dialogs.addEditDelivery.notes")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("management.delivery.dialogs.addEditDelivery.additionalNotes")}
              rows={3}
            />
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
