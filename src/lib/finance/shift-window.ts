/**
 * Turning a POS till session (`Shift`) into a plain time window.
 *
 * Every "filter by shift" control in the app — Order History, the daily
 * report, and Finance — means *the same thing*: orders placed between the
 * shift's `openedAt` and `closedAt`. Deliberately NOT `Order.shiftId`
 * linkage, because storefront/aggregator orders taken while the till was
 * open carry `shiftId: null` and a daily report has to count them. (The
 * per-till attribution semantics still exist and are still correct for
 * cash reconciliation — see `shiftFilter()` in report-filters.ts.)
 *
 * Because the window is just a `from`/`to` pair, every consumer route works
 * unchanged: `buildOrderHistoryWhere` and each `finance/*` route already
 * parse those params as arbitrary ISO datetimes.
 *
 * DB-free on purpose (plain data in, plain data out) so it unit-tests
 * without mocking Prisma, matching report-aggregation.ts.
 */

export interface ShiftWindowInput {
  openedAt: Date | string;
  /** Null while the till is still open — the window then runs up to `now`. */
  closedAt: Date | string | null;
}

export interface ShiftWindow {
  from: Date;
  to: Date;
  /** True when the shift is still open, i.e. `to` is "now" and will keep moving. */
  isOpen: boolean;
}

/**
 * `openedAt` → `closedAt ?? now`.
 *
 * `now` is injectable so tests aren't clock-dependent; production callers
 * omit it. An open shift's window is inherently a moving target — that's
 * correct behaviour (a mid-shift report should show sales so far), and
 * `isOpen` lets the UI label it as provisional.
 */
export function resolveShiftWindow(shift: ShiftWindowInput, now: Date = new Date()): ShiftWindow {
  const from = new Date(shift.openedAt);
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : null;
  return {
    from,
    to: closedAt ?? now,
    isOpen: closedAt === null,
  };
}

export interface ShiftLabelInput extends ShiftWindowInput {
  staffMember?: { name: string } | null;
}

/**
 * Human label for a shift picker option, e.g.
 * `"Budi · 09 Aug 10:00 – 02:30"`, or `"Budi · 09 Aug 10:00 – open"`.
 *
 * Shared by the Order History and Finance pickers so the same session never
 * reads differently on two screens. Date/time formatting is injected (the
 * `formatDayDate`/`formatTimeOnly` pair off `useI18n()`) rather than done
 * here — this module stays locale-agnostic.
 */
export function formatShiftLabel(
  shift: ShiftLabelInput,
  fmt: {
    formatDayDate: (value: Date | string) => string;
    formatTimeOnly: (value: Date | string) => string;
    openLabel: string;
  }
): string {
  const opened = `${fmt.formatDayDate(shift.openedAt)} ${fmt.formatTimeOnly(shift.openedAt)}`;
  const closed = shift.closedAt ? fmt.formatTimeOnly(shift.closedAt) : fmt.openLabel;
  const name = shift.staffMember?.name;
  const range = `${opened} – ${closed}`;
  return name ? `${name} · ${range}` : range;
}
