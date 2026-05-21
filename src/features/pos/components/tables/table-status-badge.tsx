"use client";

import { Badge } from "@/components/ui/badge";
import type { TableStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  TableStatus,
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "Tersedia",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
  },
  OCCUPIED: {
    label: "Terisi",
    className: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400",
  },
  RESERVED: {
    label: "Reservasi",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
  },
  CLEANING: {
    label: "Dibersihkan",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
  },
};

interface TableStatusBadgeProps {
  status: TableStatus;
}

export function TableStatusBadge({ status }: TableStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
