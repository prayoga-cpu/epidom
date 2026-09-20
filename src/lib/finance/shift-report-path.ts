/**
 * The standalone report page for one till session — the same document the
 * Finish screen previews and the receipt printer prints, so a link to it never
 * disagrees with the paper.
 *
 * `print` off (the default) opens it for reading; on, the page raises the
 * browser's print dialog straight away. Client-safe: nothing here touches the
 * server, so the POS Shift page and the Back Office Shifts page share it.
 */
export function shiftReportPath(
  storeId: string,
  shiftId: string,
  options: { print?: boolean } = {}
): string {
  return `/store/${storeId}/pos/orders/daily-report?shiftId=${shiftId}${options.print ? "" : "&print=0"}`;
}
