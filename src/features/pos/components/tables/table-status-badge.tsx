"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/lang/i18n-provider";
import type { TableStatus } from "@prisma/client";

const STATUS_CLASSNAMES: Record<TableStatus, string> = {
  AVAILABLE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
  OCCUPIED: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400",
  RESERVED: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
  CLEANING: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
};

const STATUS_KEYS: Record<TableStatus, string> = {
  AVAILABLE: "pos.tables.status.available",
  OCCUPIED: "pos.tables.status.occupied",
  RESERVED: "pos.tables.status.reserved",
  CLEANING: "pos.tables.status.cleaning",
};

interface TableStatusBadgeProps {
  status: TableStatus;
}

export function TableStatusBadge({ status }: TableStatusBadgeProps) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className={STATUS_CLASSNAMES[status]}>
      {t(STATUS_KEYS[status])}
    </Badge>
  );
}
