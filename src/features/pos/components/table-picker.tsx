"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnlineStatus } from "@/hooks/use-network-status";
import { usePosTables } from "../hooks/use-pos-tables";
import { TableStatusBadge } from "./tables/table-status-badge";

const NO_TABLE = "__none__";
const CUSTOM = "__custom__";

interface TablePickerProps {
  storeId: string;
  /** The picked registered table, or null for a typed one / none. */
  tableId: string | null;
  tableNumber: string;
  onPick: (table: { id: string; label: string } | null) => void;
  onCustom: (tableNumber: string) => void;
  idPrefix: string;
}

/**
 * The table of a dine-in sale. A dropdown of the store's registered tables
 * (Tables page) with their seats and status, so the order links to the real
 * table and seats it; "Custom…" at the bottom opens a box for anything that
 * isn't registered (a terrace spot, a bar stool). A store with no tables just
 * gets the box.
 *
 * Offline, or if the list can't load, the box still works: a typed table needs
 * no network.
 */
export function TablePicker({
  storeId,
  tableId,
  tableNumber,
  onPick,
  onCustom,
  idPrefix,
}: TablePickerProps) {
  const { t } = useI18n();
  const online = useOnlineStatus();
  const { data: tables, isError } = usePosTables(storeId, online);
  // Custom is a mode, not just "some text": picking it shows an empty box that
  // must stay open while the cashier types.
  const [custom, setCustom] = useState(() => !tableId && tableNumber.trim() !== "");

  const triggerId = `${idPrefix}-table`;
  const inputId = `${idPrefix}-table-number`;
  const list = Array.isArray(tables) ? tables : [];

  const customInput = (
    <Input
      id={inputId}
      className="h-11"
      placeholder="A1, B2..."
      aria-label={t("cashierCart.table.customPlaceholder")}
      value={tableNumber}
      onChange={(e) => onCustom(e.target.value)}
      maxLength={40}
    />
  );

  // Offline, nothing registered, or the list couldn't load: a plain box, as before.
  if (!online || (tables && list.length === 0) || (isError && !tableId)) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>{t("pos.checkout.tableOptional")}</Label>
        {customInput}
        {isError && (
          <p className="text-muted-foreground text-xs">{t("cashierCart.table.loadFailed")}</p>
        )}
      </div>
    );
  }

  const value = tableId ?? (custom ? CUSTOM : NO_TABLE);
  const shown = tableId
    ? tableNumber
    : custom
      ? t("cashierCart.table.custom")
      : t("cashierCart.table.none");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={triggerId}>{t("pos.checkout.tableOptional")}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next === NO_TABLE) {
            setCustom(false);
            onPick(null);
          } else if (next === CUSTOM) {
            setCustom(true);
            // Keeps the label, drops the link: "A1" can be tweaked into "A1 terrace".
            onCustom(tableNumber);
          } else {
            const table = list.find((row) => row.id === next);
            if (!table) return;
            setCustom(false);
            onPick({ id: table.id, label: table.label });
          }
        }}
      >
        <SelectTrigger id={triggerId} className="h-11 w-full">
          {/* Children override the item text: a linked table still reads right
              while the list is loading. */}
          <SelectValue>{shown}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NO_TABLE} className="min-h-11">
            {t("cashierCart.table.none")}
          </SelectItem>
          {list.map((table) => (
            <SelectItem key={table.id} value={table.id} className="min-h-11">
              <span className="flex w-full items-center gap-2">
                <span className="font-medium">{table.label}</span>
                <span className="text-muted-foreground text-xs">
                  {t("cashierCart.table.seats").replace("{count}", String(table.capacity))}
                </span>
                <TableStatusBadge status={table.status} />
              </span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM} className="min-h-11">
            {t("cashierCart.table.customOption")}
          </SelectItem>
        </SelectContent>
      </Select>
      {custom && !tableId && customInput}
    </div>
  );
}
