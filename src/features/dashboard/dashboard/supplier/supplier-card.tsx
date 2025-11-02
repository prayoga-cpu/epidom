"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Mail, Star } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { MOCK_SUPPLIERS } from "@/mocks";
import DashboardCard from "../_components/dashboard-card";

export default function SupplierCard() {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  // Get top suppliers by rating
  const topSuppliers = useMemo(() => {
    return [...MOCK_SUPPLIERS].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
  }, []);

  const cardContent = (
    <div className="h-full overflow-auto">
      {topSuppliers.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
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
                    {supplier.rating && (
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{supplier.rating.toFixed(1)}</span>
                      </div>
                    )}
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
