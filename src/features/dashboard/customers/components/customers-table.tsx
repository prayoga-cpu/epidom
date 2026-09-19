"use client";

import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CustomerRowDto } from "@/types/api/cashier";
import { useCustomerFormatters } from "../hooks/use-customer-formatters";

interface CustomersTableProps {
  customers: CustomerRowDto[];
  /** Member since + Points columns exist only when the store runs a loyalty program. */
  loyaltyEnabled: boolean;
  onSelect: (customer: CustomerRowDto) => void;
  /** The API returned a `nextCursor`. */
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * Wide by nature: it scrolls sideways on a phone instead of squeezing seven
 * columns (AGENTS.md §6). The outer box bleeds to the screen edges on mobile
 * (-mx-4); the inner min-w is what makes it scroll rather than overflow.
 */
function ScrollFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-4 overflow-x-auto sm:mx-0", className)}>
      <div className="min-w-[720px] border-y sm:rounded-lg sm:border">{children}</div>
    </div>
  );
}

function ColumnHeaders({ loyaltyEnabled }: { loyaltyEnabled: boolean }) {
  const { t } = useI18n();
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="px-4">{t("customers.table.name")}</TableHead>
        <TableHead className="px-4">{t("customers.table.customerSince")}</TableHead>
        {loyaltyEnabled && (
          <>
            <TableHead className="px-4">{t("customers.table.memberSince")}</TableHead>
            <TableHead className="px-4 text-right">{t("customers.table.points")}</TableHead>
          </>
        )}
        <TableHead className="px-4 text-right">{t("customers.table.lifetimeSpend")}</TableHead>
        <TableHead className="px-4 text-right">{t("customers.table.orders")}</TableHead>
        <TableHead className="px-4">{t("customers.table.lastVisit")}</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function CustomersTableSkeleton({ loyaltyEnabled }: { loyaltyEnabled: boolean }) {
  const cellCount = loyaltyEnabled ? 7 : 5;
  return (
    <ScrollFrame>
      <Table aria-busy="true">
        <ColumnHeaders loyaltyEnabled={loyaltyEnabled} />
        <TableBody>
          {Array.from({ length: 6 }, (_, row) => (
            <TableRow key={row} className="hover:bg-transparent">
              {Array.from({ length: cellCount }, (_, cell) => (
                <TableCell key={cell} className="px-4 py-3">
                  <Skeleton className={cn("h-5", cell === 0 ? "w-36" : "w-16")} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollFrame>
  );
}

export function CustomersTable({
  customers,
  loyaltyEnabled,
  onSelect,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: CustomersTableProps) {
  const { t } = useI18n();
  const { currency, formatPrice: rawFormatPrice } = useCurrency();
  const fmt = useCustomerFormatters();

  // lifetimeSpend is a LITERAL amount in the store's display currency (Order.total
  // is stored that way). Passing `currency` as the second argument is what stops
  // formatPrice from treating it as IDR and converting it — dropping it has
  // shipped wrong money in this app before.
  const formatPrice = (value: number) => rawFormatPrice(value, currency);

  return (
    <div className="space-y-3">
      <ScrollFrame>
        <Table>
          <ColumnHeaders loyaltyEnabled={loyaltyEnabled} />
          <TableBody>
            {customers.map((customer) => {
              // Phone first: it is what a cashier searches by and what is unique.
              const contact = [customer.phone, customer.email].filter(Boolean).join(" · ");
              return (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(customer)}
                >
                  <TableCell className="px-4 py-2">
                    {/* A real button, always visible: the row click is a
                        convenience, never the only way in (keyboard, touch). */}
                    <button
                      type="button"
                      className="focus-visible:ring-ring flex min-h-10 max-w-64 min-w-0 flex-col items-start justify-center rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="max-w-full truncate font-medium">{customer.name}</span>
                      {contact && (
                        <span className="text-muted-foreground max-w-full truncate text-xs">
                          {contact}
                        </span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-4 py-2">
                    {fmt.date(customer.createdAt)}
                  </TableCell>
                  {loyaltyEnabled && (
                    <>
                      <TableCell className="text-muted-foreground px-4 py-2">
                        {fmt.date(customer.memberSince)}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums">
                        {fmt.number(customer.points)}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="px-4 py-2 text-right tabular-nums">
                    {formatPrice(customer.lifetimeSpend)}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right tabular-nums">
                    {fmt.number(customer.orderCount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground px-4 py-2">
                    {fmt.date(customer.lastOrderAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollFrame>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 min-w-40"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore && <Loader2 className="size-4 animate-spin" />}
            {isLoadingMore ? t("customers.table.loadingMore") : t("customers.table.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
