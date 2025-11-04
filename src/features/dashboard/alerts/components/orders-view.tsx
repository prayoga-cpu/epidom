"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  useSupplierOrders,
  useUpdateSupplierOrder,
} from "@/features/dashboard/tracking/hooks/use-supplier-orders";
import { Phone, Mail, MapPin, Package, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function OrdersView() {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params?.storeId as string;
  const [placingOrder, setPlacingOrder] = useState<string | null>(null);

  const { data, isLoading, error } = useSupplierOrders(storeId);

  // Handler to mark order as placed
  const handleMarkAsPlaced = async (orderId: string) => {
    setPlacingOrder(orderId);
    try {
      const response = await fetch(`/api/stores/${storeId}/supplier-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PLACED" }),
      });

      if (!response.ok) throw new Error("Failed to update order");

      toast.success(t("alerts.orderPlaced") || "Order marked as placed!");

      // Refresh the data
      window.location.reload();
    } catch (error) {
      toast.error(t("alerts.orderPlacedError") || "Failed to mark order as placed");
    } finally {
      setPlacingOrder(null);
    }
  };

  // Group orders by supplier and filter only PENDING status
  const ordersBySupplier = useMemo(() => {
    if (!data?.orders) return [];

    // Filter only pending orders
    const pendingOrders = data.orders.filter((order) => order.status === "PENDING");

    // Group by supplier
    const grouped = new Map<string, typeof pendingOrders>();

    pendingOrders.forEach((order) => {
      const supplierId = order.supplier.id;

      if (!grouped.has(supplierId)) {
        grouped.set(supplierId, []);
      }

      grouped.get(supplierId)!.push(order);
    });

    return Array.from(grouped.entries()).map(([supplierId, orders]) => {
      const supplier = orders[0].supplier;

      // Flatten all items from all orders for this supplier
      const allItems = orders.flatMap((order) => order.items);

      return {
        supplier,
        orders,
        items: allItems,
      };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="text-muted-foreground mb-4 h-8 w-8 animate-spin" />
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-destructive/10 mb-4 rounded-full p-3">
          <AlertCircle className="text-destructive h-6 w-6" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">{t("common.error")}</h3>
        <p className="text-muted-foreground text-sm">
          {error.message || t("alerts.errorLoadingOrders")}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {ordersBySupplier.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">{t("alerts.noOrdersToPlace")}</h3>
            <p className="text-muted-foreground text-sm">{t("alerts.noOrdersDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {ordersBySupplier.map((supplierGroup, idx) => {
            const { supplier, items, orders } = supplierGroup;

            return (
              <Card key={idx} className="transition-shadow hover:shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="from-primary/20 to-primary/10 text-primary bg-gradient-to-br text-lg font-bold">
                        {supplier.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-lg">{supplier.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {items.length} {items.length === 1 ? t("alerts.item") : t("alerts.items")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Contact Information */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      {t("alerts.contactInfo")}
                    </h3>

                    {/* Phone */}
                    {supplier.phone && (
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <Phone className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm">{supplier.phone}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2"
                          onClick={() => window.open(`tel:${supplier.phone}`, "_self")}
                        >
                          {t("alerts.actions.callSupplier")}
                        </Button>
                      </div>
                    )}

                    {/* Email */}
                    {supplier.email && (
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <Mail className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm">{supplier.email}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2"
                          onClick={() => window.open(`mailto:${supplier.email}`, "_blank")}
                        >
                          {t("alerts.actions.emailSupplier")}
                        </Button>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Materials to Order */}
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Package className="h-4 w-4" />
                      {t("alerts.materialsToOrder")}
                    </h3>

                    <div className="space-y-2">
                      {items.map((item, itemIdx) => (
                        <div key={itemIdx} className="bg-muted/50 space-y-1 rounded-md p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{item.material.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {item.material.sku}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">{t("alerts.quantity")}:</span>
                              <span className="ml-1 font-semibold text-blue-600">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{t("alerts.price")}:</span>
                              <span className="ml-1 font-semibold text-green-600">
                                ${Number(item.unitPrice).toFixed(2)} / {item.unit}
                              </span>
                            </div>
                          </div>
                          <div className="pt-1 text-xs font-semibold">
                            <span className="text-muted-foreground">{t("alerts.total")}:</span>
                            <span className="ml-1 text-orange-600">
                              ${Number(item.total).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Summary */}
                    {orders.length > 0 && (
                      <>
                        <div className="bg-primary/5 mt-3 rounded-md p-3">
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>{t("alerts.orderTotal")}:</span>
                            <span className="text-primary">
                              $
                              {orders
                                .reduce((sum, order) => sum + Number(order.total), 0)
                                .toFixed(2)}
                            </span>
                          </div>
                          {orders[0].expectedDate && (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {t("alerts.expectedDelivery")}:{" "}
                              {new Date(orders[0].expectedDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-3 flex gap-2">
                          {orders.map((order) => (
                            <Button
                              key={order.id}
                              onClick={() => handleMarkAsPlaced(order.id)}
                              disabled={placingOrder === order.id}
                              className="flex-1"
                            >
                              {placingOrder === order.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {t("alerts.placing")}
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {t("alerts.markAsPlaced")}
                                </>
                              )}
                            </Button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
