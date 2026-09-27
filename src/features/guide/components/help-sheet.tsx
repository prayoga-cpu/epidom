"use client";

import { CircleHelp, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { useI18n } from "@/components/lang/i18n-provider";
import { HelpCenter } from "./help-center";

export interface HelpSheetProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Owner / manager on this device: shows the tour and checklist shortcuts. */
  canManage?: boolean;
  /** Open straight on this guide (a page intro's Learn more). */
  initialGuideSlug?: string | null;
}

/**
 * The Help centre in a right-hand sheet, for POS Mode (the Epidom menu's
 * "Help & what's new" row and the page intros' Learn more): the till never
 * has to leave POS Mode to read a guide.
 *
 * Sized like the Epidom menu's own sheet — an explicit height divided by
 * --app-zoom, so the body scrolls inside it while the title stays put — and
 * closed the same way: a 40px close button in the title row, not the Sheet's
 * default 16px corner X (the iPad touch floor).
 */
export function HelpSheet({
  storeId,
  open,
  onOpenChange,
  canManage = false,
  initialGuideSlug,
}: HelpSheetProps) {
  const { t } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        title={t("helpCenter.sheetTitle")}
        description={t("helpCenter.sheetDescription")}
        hideClose
        className="h-[calc(100dvh/var(--app-zoom,1))] w-[min(420px,calc(92vw/var(--app-zoom,1)))] gap-0 overflow-hidden p-0 sm:max-w-none md:w-[max(420px,calc(40vw/var(--app-zoom,1)))]"
      >
        <div className="flex shrink-0 items-center gap-2 border-b py-2 pr-2 pl-4">
          <CircleHelp className="text-muted-foreground size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-base font-semibold">
            {t("helpCenter.sheetTitle")}
          </p>
          <SheetClose className="hover:bg-muted focus-visible:ring-ring flex size-10 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2">
            <X className="size-5" aria-hidden />
            <span className="sr-only">{t("common.actions.close")}</span>
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <HelpCenter
            context="pos"
            storeId={storeId}
            canManage={canManage}
            initialGuideSlug={initialGuideSlug}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
