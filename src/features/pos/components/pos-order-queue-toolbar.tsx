"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  CheckCircle2,
  Flame,
  PackageCheck,
  PauseCircle,
  Inbox,
  Search,
  X,
  LayoutGrid,
  Rows3,
  Kanban,
  type LucideIcon,
} from "lucide-react";
import {
  QUEUE_FILTER_KEYS,
  QUEUE_PAYMENT_METHODS,
  QUEUE_STATUSES,
  type QueueDepartmentFilter,
  type QueueFilterKey,
  type QueuePaymentMethodFilter,
  type QueueSortBy,
  type QueueSourceFilter,
  type QueueStatusFilter,
  type QueueTypeFilter,
  type QueueView,
} from "../lib/order-queue-filters";
import { mapPaymentMethodLabel } from "../lib/order-status-display";
import { UnpaidFilterToggle } from "./unpaid-filter-toggle";
import { AddFilterMenu } from "./add-filter-menu";
import { RemovableFilter } from "./removable-filter";

interface FilterOption {
  id: string;
  name: string;
}

const STATUS_META: Record<
  Exclude<QueueStatusFilter, "ALL">,
  { icon: LucideIcon; color: string; ring: string }
> = {
  PENDING: { icon: Clock, color: "text-amber-500", ring: "ring-amber-500/50" },
  CONFIRMED: { icon: CheckCircle2, color: "text-blue-500", ring: "ring-blue-500/50" },
  IN_PRODUCTION: { icon: Flame, color: "text-orange-500", ring: "ring-orange-500/50" },
  READY: { icon: PackageCheck, color: "text-emerald-500", ring: "ring-emerald-500/50" },
  HELD: { icon: PauseCircle, color: "text-slate-500", ring: "ring-slate-500/50" },
};

const VIEW_OPTIONS: { key: QueueView; icon: LucideIcon }[] = [
  { key: "grid", icon: LayoutGrid },
  { key: "compact", icon: Rows3 },
  { key: "board", icon: Kanban },
];

interface PosOrderQueueToolbarProps {
  statusCounts: Record<string, number>;
  statusFilter: QueueStatusFilter;
  onStatusFilterChange: (value: QueueStatusFilter) => void;
  sourceFilter: QueueSourceFilter;
  onSourceFilterChange: (value: QueueSourceFilter) => void;
  typeFilter: QueueTypeFilter;
  onTypeFilterChange: (value: QueueTypeFilter) => void;
  departmentFilter: QueueDepartmentFilter;
  onDepartmentFilterChange: (value: QueueDepartmentFilter) => void;
  productFilter: string;
  onProductFilterChange: (value: string) => void;
  productOptions: FilterOption[];
  staffFilter: string;
  onStaffFilterChange: (value: string) => void;
  staffOptions: FilterOption[];
  paymentMethodFilter: QueuePaymentMethodFilter;
  onPaymentMethodFilterChange: (value: QueuePaymentMethodFilter) => void;
  activeFilterKeys: QueueFilterKey[];
  onAddFilter: (key: QueueFilterKey) => void;
  onRemoveFilter: (key: QueueFilterKey) => void;
  unpaidOnly: boolean;
  onUnpaidOnlyChange: (value: boolean) => void;
  unpaidCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: QueueSortBy;
  onSortByChange: (value: QueueSortBy) => void;
  view: QueueView;
  onViewChange: (value: QueueView) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function PosOrderQueueToolbar({
  statusCounts,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  typeFilter,
  onTypeFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  productFilter,
  onProductFilterChange,
  productOptions,
  staffFilter,
  onStaffFilterChange,
  staffOptions,
  paymentMethodFilter,
  onPaymentMethodFilterChange,
  activeFilterKeys,
  onAddFilter,
  onRemoveFilter,
  unpaidOnly,
  onUnpaidOnlyChange,
  unpaidCount,
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  view,
  onViewChange,
  hasActiveFilters,
  onClearFilters,
}: PosOrderQueueToolbarProps) {
  const { t } = useI18n();

  const mapStatusLabel = (status: string) => {
    const key = status === "IN_PRODUCTION" ? "inProduction" : status.toLowerCase();
    return t(`pos.status.${key}`);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Status tiles — click to filter; click again to clear */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <button
          type="button"
          onClick={() => onStatusFilterChange("ALL")}
          className={cn(
            "border-border bg-card rounded-lg border p-2.5 text-left transition-all hover:border-foreground/20",
            statusFilter === "ALL" && "ring-primary/50 ring-2 ring-offset-2 ring-offset-background"
          )}
        >
          <div className="mb-1 flex items-center justify-between">
            <p className="text-muted-foreground text-xs">{t("pos.queue.all")}</p>
            <Inbox className="text-muted-foreground h-3.5 w-3.5" />
          </div>
          <p className="text-foreground text-lg font-bold">{statusCounts.ALL ?? 0}</p>
        </button>
        {QUEUE_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusFilterChange(active ? "ALL" : status)}
              className={cn(
                "border-border bg-card rounded-lg border p-2.5 text-left transition-all hover:border-foreground/20",
                active && `ring-2 ring-offset-2 ring-offset-background ${meta.ring}`
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-muted-foreground truncate text-xs">{mapStatusLabel(status)}</p>
                <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
              </div>
              <p className="text-foreground text-lg font-bold">{statusCounts[status] ?? 0}</p>
            </button>
          );
        })}
      </div>

      {/* Search, filters, sort, view switcher */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("pos.queue.searchPlaceholder")}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <UnpaidFilterToggle
            active={unpaidOnly}
            onToggle={() => onUnpaidOnlyChange(!unpaidOnly)}
            count={unpaidCount}
            className="h-8 px-2.5 text-xs"
          />
          {activeFilterKeys.includes("source") && (
            <RemovableFilter onRemove={() => onRemoveFilter("source")}>
              <Select
                value={sourceFilter}
                onValueChange={(v) => onSourceFilterChange(v as QueueSourceFilter)}
              >
                <SelectTrigger size="sm" className="w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("pos.queue.filterAllSources")}</SelectItem>
                  <SelectItem value="POS">{t("pos.source.walkIn")}</SelectItem>
                  <SelectItem value="ONLINE">{t("pos.source.online")}</SelectItem>
                </SelectContent>
              </Select>
            </RemovableFilter>
          )}
          {activeFilterKeys.includes("type") && (
            <RemovableFilter onRemove={() => onRemoveFilter("type")}>
              <Select
                value={typeFilter}
                onValueChange={(v) => onTypeFilterChange(v as QueueTypeFilter)}
              >
                <SelectTrigger size="sm" className="w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("pos.queue.filterAllTypes")}</SelectItem>
                  <SelectItem value="DINE_IN">{t("pos.checkout.dineIn")}</SelectItem>
                  <SelectItem value="TAKEAWAY">{t("pos.checkout.takeaway")}</SelectItem>
                  <SelectItem value="DELIVERY">{t("pos.history.delivery")}</SelectItem>
                </SelectContent>
              </Select>
            </RemovableFilter>
          )}
          {activeFilterKeys.includes("department") && (
            <RemovableFilter onRemove={() => onRemoveFilter("department")}>
              <Select
                value={departmentFilter}
                onValueChange={(v) => onDepartmentFilterChange(v as QueueDepartmentFilter)}
              >
                <SelectTrigger size="sm" className="w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("common.department")}</SelectItem>
                  <SelectItem value="KITCHEN">{t("common.departmentKitchen")}</SelectItem>
                  <SelectItem value="BAR">{t("common.departmentBar")}</SelectItem>
                </SelectContent>
              </Select>
            </RemovableFilter>
          )}
          {activeFilterKeys.includes("product") && productOptions.length > 0 && (
            <RemovableFilter onRemove={() => onRemoveFilter("product")}>
              <Select value={productFilter} onValueChange={onProductFilterChange}>
                <SelectTrigger size="sm" className="w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("pos.queue.filterAllProducts")}</SelectItem>
                  {productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </RemovableFilter>
          )}
          {activeFilterKeys.includes("staff") && staffOptions.length > 0 && (
            <RemovableFilter onRemove={() => onRemoveFilter("staff")}>
              <Select value={staffFilter} onValueChange={onStaffFilterChange}>
                <SelectTrigger size="sm" className="w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("pos.queue.filterAllStaff")}</SelectItem>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </RemovableFilter>
          )}
          {activeFilterKeys.includes("paymentMethod") && (
            <RemovableFilter onRemove={() => onRemoveFilter("paymentMethod")}>
              <Select
                value={paymentMethodFilter}
                onValueChange={(v) => onPaymentMethodFilterChange(v as QueuePaymentMethodFilter)}
              >
                <SelectTrigger size="sm" className="w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("pos.queue.filterAllPaymentMethods")}</SelectItem>
                  {QUEUE_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {mapPaymentMethodLabel(t, m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </RemovableFilter>
          )}
          <AddFilterMenu
            options={QUEUE_FILTER_KEYS.filter((k) => !activeFilterKeys.includes(k)).map((k) => ({
              key: k,
              label: t(`pos.filters.${k}`),
            }))}
            onAdd={(k) => onAddFilter(k as QueueFilterKey)}
            className="h-8 px-2.5 text-xs"
          />
          <Select value={sortBy} onValueChange={(v) => onSortByChange(v as QueueSortBy)}>
            <SelectTrigger size="sm" className="w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("pos.queue.sortNewest")}</SelectItem>
              <SelectItem value="oldest">{t("pos.queue.sortOldest")}</SelectItem>
              <SelectItem value="total-desc">{t("pos.queue.sortTotalDesc")}</SelectItem>
              <SelectItem value="total-asc">{t("pos.queue.sortTotalAsc")}</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              <X className="h-3 w-3" />
              {t("pos.queue.clearFilters")}
            </button>
          )}
        </div>

        <div className="bg-muted flex items-center gap-1 self-start rounded-lg p-1 lg:self-auto">
          {VIEW_OPTIONS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onViewChange(key)}
              title={t(`pos.queue.view${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t(`pos.queue.view${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
