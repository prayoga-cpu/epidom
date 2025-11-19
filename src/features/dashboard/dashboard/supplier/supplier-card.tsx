"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Mail, Star, Loader2, Package, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useSuppliers } from "@/features/dashboard/data/suppliers/hooks/use-suppliers";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import { DashboardCard } from "../components/dashboard-card";

export default function SupplierCard() {
  const { t } = useI18n();
  const router = useRouter();
  const { storeId } = useCurrentStore();
  const { supplierManagementAccess, isLoading: isLoadingAccess } = useFeatureAccess();

  // Fetch suppliers from API
  const { data, isLoading, error } = useSuppliers(storeId || "", {
    sortBy: "name",
    sortOrder: "asc",
  });

  // Get top suppliers (first 4 from the list)
  const topSuppliers = useMemo(() => {
    if (!data?.suppliers) return [];
    return data.suppliers.slice(0, 4);
  }, [data]);

  // Check if subscription is locked (STARTER plan)
  const isSubscriptionLocked =
    (!isLoadingAccess && !supplierManagementAccess) ||
    (error && ((error as any).code === "SUBSCRIPTION_FEATURE_LOCKED" || (error as any).status === 403));

  const cardContent = (
    <div className="h-full overflow-auto">
      {!storeId ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      ) : isLoading || isLoadingAccess ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <Loader2 className="text-muted-foreground mb-3 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      ) : isSubscriptionLocked ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            {t("data.suppliers.locked")}
          </p>
          <Button
            onClick={() => router.push("/pricing")}
            size="sm"
            className="bg-[var(--color-brand-primary)] hover:opacity-90"
          >
            {t("billing.upgradeToPro")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : error ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <Package className="text-muted-foreground mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t("messages.errorLoadingSuppliers")}</p>
        </div>
      ) : topSuppliers.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <Package className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground text-sm">
            {t("dashboard.supplierCard.noSuppliersAvailable")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {topSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="hover:bg-muted/50 rounded-lg border p-3 transition-colors"
            >
              <div className="mb-2 flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="from-primary/20 to-primary/10 text-primary bg-gradient-to-br font-bold">
                    {supplier.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{supplier.name}</p>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">{supplier.contactPerson}</p>
                </div>
              </div>

              <div className="ml-13 flex flex-col gap-1">
                {supplier.phone && (
                  <a
                    href={`tel:${supplier.phone}`}
                    className="text-primary flex items-center gap-2 text-xs hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{supplier.phone}</span>
                  </a>
                )}
                {supplier.email && (
                  <a
                    href={`mailto:${supplier.email}`}
                    className="text-primary flex items-center gap-2 text-xs hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{supplier.email}</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const cardOther = (
    <Link href={`/store/${storeId}/data`}>
      <Button variant="ghost" size="sm" className="h-8">
        {t("dashboard.supplierCard.manage")}
      </Button>
    </Link>
  );

  return (
    <DashboardCard
      cardTitle={t("dashboard.supplierCard.title")}
      cardDescription={t("dashboard.supplierCard.description")}
      cardOther={cardOther}
      cardContent={cardContent}
    />
  );
}
