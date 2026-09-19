"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Download, Loader2, Plus, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDialogSwap } from "@/components/ui/use-dialog-swap";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import type { CustomerRowDto } from "@/types/api/cashier";
import { useExportCustomers } from "../hooks/use-customer-mutations";
import {
  useCustomerDetail,
  useCustomerList,
  useCustomerSummary,
  useLoyaltyEnabled,
  type CustomerSortOption,
} from "../hooks/use-customer-queries";
import { useCustomerFormatters } from "../hooks/use-customer-formatters";
import { CustomerDetailSheet } from "./customer-detail-sheet";
import { CustomerFormDialog } from "./customer-form-dialog";
import { CustomersSummary } from "./customers-summary";
import { CustomersTable, CustomersTableSkeleton } from "./customers-table";

interface CustomersClientProps {
  storeId: string;
  /**
   * Owner / manager. False (a cashier persona) makes the page read-only: no
   * Edit, no Adjust points, no Export — the API refuses all three anyway, this
   * just doesn't offer buttons that would fail. Adding a customer stays open to
   * everyone: it is POS-tier.
   */
  canManage: boolean;
}

function StateBlock({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        {icon}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function CustomersClient({ storeId, canManage }: CustomersClientProps) {
  const { t } = useI18n();
  const fmt = useCustomerFormatters();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CustomerSortOption>("name");
  const debouncedSearch = useDebounce(search.trim(), 300);

  const [addOpen, setAddOpen] = useState(false);
  // The picked row stays put after the drawer closes (only `sheetOpen` flips), so
  // the drawer's content survives its own slide-out animation instead of
  // emptying while it is still on screen.
  const [selected, setSelected] = useState<CustomerRowDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Editing is opened FROM the drawer. A Dialog stacked over a Sheet would sit
  // behind it (sheet z-70, dialog z-50) and leave two overlays, so swap: the
  // drawer steps aside while the form is up and returns when it closes.
  const swap = useDialogSwap<"edit">(sheetOpen);

  const loyalty = useLoyaltyEnabled(storeId);
  const summary = useCustomerSummary(storeId);
  const list = useCustomerList(storeId, { q: debouncedSearch, sort });
  const detail = useCustomerDetail(storeId, selected?.id ?? null);
  const exportCsv = useExportCustomers(storeId);

  const customers = useMemo(
    () => list.data?.pages.flatMap((page) => page.customers) ?? [],
    [list.data]
  );
  const matchCount = list.data?.pages.at(-1)?.totalCount ?? 0;
  const isSearching = debouncedSearch !== "";

  // Sorting by points means nothing without a program, so the option isn't offered.
  const sortOptions: CustomerSortOption[] = loyalty.enabled
    ? ["name", "newest", "oldest", "points"]
    : ["name", "newest", "oldest"];

  const openDetail = (customer: CustomerRowDto) => {
    setSelected(customer);
    setSheetOpen(true);
  };

  const handleExport = () => {
    exportCsv.mutate(debouncedSearch, {
      onSuccess: () => toast.success(t("customers.export.success")),
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : t("customers.export.failed")),
    });
  };

  // The table's columns depend on the loyalty answer, so hold the skeleton until
  // it lands rather than painting Member-since/Points columns that vanish.
  const isInitialLoading = !loyalty.isSettled || (list.isPending && !list.data);

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
          {t("customers.page.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("customers.page.description")}</p>
      </div>

      <CustomersSummary
        loyaltyEnabled={loyalty.enabled}
        isLoading={!loyalty.isSettled || summary.isPending}
        summary={summary.data?.summary}
        totalCount={summary.data?.totalCount}
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="text"
            inputMode="search"
            autoComplete="off"
            className="h-10 pr-10 pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("customers.toolbar.searchLabel")}
            placeholder={t("customers.toolbar.searchPlaceholder")}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("customers.toolbar.clearSearch")}
              className="text-muted-foreground hover:text-foreground absolute top-0 right-0 flex size-10 items-center justify-center"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={sort} onValueChange={(value) => setSort(value as CustomerSortOption)}>
            {/* data-[size=default]:h-10, not h-10: the trigger's own height is set
                under that data variant, which outranks a bare h-* class. */}
            <SelectTrigger
              className="min-w-0 flex-1 data-[size=default]:h-10 sm:w-48 sm:flex-none"
              aria-label={t("customers.toolbar.sortLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option} value={option} className="min-h-10">
                  {t(`customers.sort.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canManage && (
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 sm:flex-none"
              onClick={handleExport}
              disabled={exportCsv.isPending}
            >
              {exportCsv.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exportCsv.isPending
                ? t("customers.toolbar.exporting")
                : t("customers.toolbar.exportCsv")}
            </Button>
          )}

          <Button
            type="button"
            className="h-10 flex-1 sm:flex-none"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-4" />
            {t("customers.toolbar.add")}
          </Button>
        </div>
      </div>

      {isInitialLoading ? (
        <CustomersTableSkeleton loyaltyEnabled={loyalty.enabled} />
      ) : list.isError && !list.data ? (
        <StateBlock
          icon={<AlertCircle className="size-6" />}
          title={t("customers.states.errorTitle")}
          description={t("customers.states.errorDescription")}
          action={
            <Button type="button" variant="outline" className="h-10" onClick={() => list.refetch()}>
              {t("customers.states.retry")}
            </Button>
          }
        />
      ) : customers.length === 0 ? (
        isSearching ? (
          <StateBlock
            icon={<Search className="size-6" />}
            title={t("customers.states.noResultsTitle")}
            description={t("customers.states.noResultsDescription").replace(
              "{query}",
              debouncedSearch
            )}
            action={
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setSearch("")}
              >
                {t("customers.states.clearSearch")}
              </Button>
            }
          />
        ) : (
          <StateBlock
            icon={<Users className="size-6" />}
            title={t("customers.states.emptyTitle")}
            description={t("customers.states.emptyDescription")}
            action={
              <Button type="button" className="h-10" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                {t("customers.toolbar.add")}
              </Button>
            }
          />
        )
      ) : (
        // isPlaceholderData: the previous search's rows, kept on screen while the
        // new one loads — dimmed so it doesn't read as the final answer.
        <div
          className={cn("space-y-2 transition-opacity", list.isPlaceholderData && "opacity-60")}
          aria-busy={list.isPlaceholderData}
        >
          <p className="text-muted-foreground text-xs">
            {t("customers.table.showing")
              .replace("{shown}", fmt.number(customers.length))
              .replace("{total}", fmt.number(matchCount))}
          </p>
          <CustomersTable
            customers={customers}
            loyaltyEnabled={loyalty.enabled}
            onSelect={openDetail}
            hasMore={list.hasNextPage}
            isLoadingMore={list.isFetchingNextPage}
            onLoadMore={() => list.fetchNextPage()}
          />
        </div>
      )}

      <CustomerFormDialog
        storeId={storeId}
        open={addOpen}
        onOpenChange={setAddOpen}
        customer={null}
      />

      <CustomerDetailSheet
        storeId={storeId}
        customer={selected}
        open={swap.baseOpen}
        onOpenChange={setSheetOpen}
        canManage={canManage}
        loyaltyEnabled={loyalty.enabled}
        onEdit={() => swap.open("edit")}
      />

      {/* A sibling of the drawer, never inside it: the drawer's content unmounts
          while this layer is showing (see useDialogSwap). Edits the freshest copy. */}
      {canManage && (
        <CustomerFormDialog
          storeId={storeId}
          {...swap.layerProps("edit")}
          customer={detail.data ?? selected}
        />
      )}
    </div>
  );
}
