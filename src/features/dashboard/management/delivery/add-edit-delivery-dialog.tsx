"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import {
  SupplierDelivery,
  DeliveryType,
  SupplierDeliveryStatus,
  SupplierDeliveryItem
} from "@/types/entities";
import { MOCK_SUPPLIERS, MOCK_MATERIALS } from "@/mocks";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils/formatting";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AddEditDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: SupplierDelivery | null;
  mode: "add" | "edit";
}

interface DeliveryItemForm {
  materialId: string;
  quantity: number;
  unit: string;
  notes: string;
}

export default function AddEditDeliveryDialog({
  open,
  onOpenChange,
  delivery,
  mode,
}: AddEditDeliveryDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  // Form state
  const [deliveryReference, setDeliveryReference] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.INCOMING);
  const [status, setStatus] = useState<SupplierDeliveryStatus>(SupplierDeliveryStatus.PENDING);
  const [expectedDate, setExpectedDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryItemForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with delivery data when editing
  useEffect(() => {
    if (delivery && mode === "edit") {
      setDeliveryReference(delivery.deliveryReference);
      setSupplierId(delivery.supplierId);
      setDeliveryType(delivery.deliveryType);
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
    } else {
      // Reset form for add mode
      setDeliveryReference(generateDeliveryReference());
      setSupplierId("");
      setDeliveryType(DeliveryType.INCOMING);
      setStatus(SupplierDeliveryStatus.PENDING);
      setExpectedDate(undefined);
      setNotes("");
      setItems([]);
    }
  }, [delivery, mode, open]);

  const generateDeliveryReference = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `DEL-${year}-${random}`;
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        materialId: "",
        quantity: 0,
        unit: "kg",
        notes: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

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

    // Validation
    if (!deliveryReference.trim()) {
      toast({
        title: t("common.validation.error"),
        description: t("management.delivery.dialogs.addEditDelivery.validation.referenceRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!supplierId) {
      toast({
        title: t("common.validation.error"),
        description: t("management.delivery.dialogs.addEditDelivery.validation.supplierRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!expectedDate) {
      toast({
        title: t("common.validation.error"),
        description: t("management.delivery.dialogs.addEditDelivery.validation.expectedDateRequired"),
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: t("common.validation.error"),
        description: t("management.delivery.dialogs.addEditDelivery.validation.atLeastOneItem"),
        variant: "destructive",
      });
      return;
    }

    // Check if all items have material selected
    const hasEmptyItems = items.some((item) => !item.materialId || item.quantity <= 0);
    if (hasEmptyItems) {
      toast({
        title: t("common.validation.error"),
        description: t("management.delivery.dialogs.addEditDelivery.validation.itemsMustHaveMaterial"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // TODO: API call to create/update delivery
    // if (mode === "add") {
    //   await createDelivery({ deliveryReference, supplierId, deliveryType, status, expectedDate, notes, items });
    // } else {
    //   await updateDelivery(delivery.id, { deliveryReference, supplierId, deliveryType, status, expectedDate, notes, items });
    // }

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      const createdDesc = t("management.delivery.dialogs.addEditDelivery.toasts.created.description") || "Delivery {reference} has been created successfully";
      const updatedDesc = t("management.delivery.dialogs.addEditDelivery.toasts.updated.description") || "Delivery {reference} has been updated successfully";
      toast({
        title: mode === "add" ? t("management.delivery.dialogs.addEditDelivery.toasts.created.title") : t("management.delivery.dialogs.addEditDelivery.toasts.updated.title"),
        description:
          mode === "add"
            ? createdDesc.replace("{reference}", deliveryReference)
            : updatedDesc.replace("{reference}", deliveryReference),
      });
      onOpenChange(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? t("management.delivery.dialogs.addEditDelivery.addTitle") : t("management.delivery.dialogs.addEditDelivery.editTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? t("management.delivery.dialogs.addEditDelivery.addDescription")
              : (t("management.delivery.dialogs.addEditDelivery.editDescription") || "Update delivery {reference}").replace("{reference}", delivery?.deliveryReference || "")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Delivery Reference */}
          <div className="space-y-2">
            <Label htmlFor="deliveryReference">{t("management.delivery.dialogs.addEditDelivery.deliveryReference")} *</Label>
            <Input
              id="deliveryReference"
              value={deliveryReference}
              onChange={(e) => setDeliveryReference(e.target.value)}
              placeholder="DEL-2025-001"
              required
            />
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label htmlFor="supplier">{t("management.delivery.dialogs.addEditDelivery.supplier")} *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="supplier">
                <SelectValue placeholder={t("management.delivery.dialogs.addEditDelivery.selectSupplier")} />
              </SelectTrigger>
              <SelectContent>
                {MOCK_SUPPLIERS.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Type & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryType">{t("management.delivery.dialogs.addEditDelivery.deliveryType")} *</Label>
              <Select
                value={deliveryType}
                onValueChange={(value) => setDeliveryType(value as DeliveryType)}
              >
                <SelectTrigger id="deliveryType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DeliveryType.INCOMING}>{t("management.delivery.type.incoming")}</SelectItem>
                  <SelectItem value={DeliveryType.OUTGOING}>{t("management.delivery.type.outgoing")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("management.delivery.dialogs.addEditDelivery.status")} *</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as SupplierDeliveryStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SupplierDeliveryStatus.PENDING}>{t("management.delivery.status.pending")}</SelectItem>
                  <SelectItem value={SupplierDeliveryStatus.IN_TRANSIT}>{t("management.delivery.status.inTransit")}</SelectItem>
                  <SelectItem value={SupplierDeliveryStatus.RECEIVED}>{t("management.delivery.status.received")}</SelectItem>
                  <SelectItem value={SupplierDeliveryStatus.CANCELLED}>{t("management.delivery.status.cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expected Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedDate">{t("management.delivery.dialogs.addEditDelivery.expectedDate")} *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="expectedDate"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expectedDate ? formatDate(expectedDate) : t("management.delivery.dialogs.addEditDelivery.selectExpectedDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={expectedDate} onSelect={setExpectedDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Items Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("management.delivery.dialogs.addEditDelivery.items")} *</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="mr-2 h-4 w-4" />
                {t("management.delivery.dialogs.addEditDelivery.addItem")}
              </Button>
            </div>

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
                      <TableHead>{t("management.delivery.dialogs.addEditDelivery.material")}</TableHead>
                      <TableHead className="w-[120px]">{t("management.delivery.dialogs.addEditDelivery.quantity")}</TableHead>
                      <TableHead className="w-[100px]">{t("management.delivery.dialogs.addEditDelivery.unit")}</TableHead>
                      <TableHead>{t("management.delivery.dialogs.addEditDelivery.notes")}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={item.materialId}
                            onValueChange={(value) => handleItemChange(index, "materialId", value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={t("management.delivery.dialogs.addEditDelivery.selectMaterial")} />
                            </SelectTrigger>
                            <SelectContent>
                              {MOCK_MATERIALS.map((material) => (
                                <SelectItem key={material.id} value={material.id}>
                                  {material.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity || ""}
                            onChange={(e) =>
                              handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)
                            }
                            className="h-9"
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.unit}
                            onValueChange={(value) => handleItemChange(index, "unit", value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="liter">liter</SelectItem>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="units">units</SelectItem>
                              <SelectItem value="piece">piece</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.notes}
                            onChange={(e) => handleItemChange(index, "notes", e.target.value)}
                            placeholder={t("management.delivery.dialogs.addEditDelivery.optionalNotes")}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === "add"
                  ? t("management.delivery.dialogs.addEditDelivery.creating")
                  : t("management.delivery.dialogs.addEditDelivery.updating")
                : mode === "add"
                  ? t("management.delivery.dialogs.addEditDelivery.createDelivery")
                  : t("management.delivery.dialogs.addEditDelivery.updateDelivery")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
