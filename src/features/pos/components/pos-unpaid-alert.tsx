"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";

interface PosUnpaidAlertProps {
  storeId: string;
  unpaidCount: number;
}

/** Full-width banner surfacing unpaid orders right on the register — tap through to the pre-filtered queue. */
export function PosUnpaidAlert({ storeId, unpaidCount }: PosUnpaidAlertProps) {
  if (unpaidCount === 0) return null;

  return (
    <Link
      href={`/store/${storeId}/pos/orders?unpaid=1`}
      className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors dark:text-amber-400"
    >
      <CircleAlert className="h-4 w-4 shrink-0" />
      <span>
        {unpaidCount} {unpaidCount === 1 ? "order" : "orders"} unpaid — tap to view
      </span>
    </Link>
  );
}
