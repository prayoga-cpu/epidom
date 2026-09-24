"use client";

import { Printer, ScanBarcode } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PosMenuCategory } from "../types/pos.types";
import { PrinterSettingsPanel } from "./printer-settings-dialog";
import { ScannerSettingsPanel } from "./pos-scanner-menu";

interface HardwareSettingsDialogProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every piece of hardware paired to THIS device, in one place — opened from
 * the POS Mode More drawer on any POS screen. Reuses the printers dialog's
 * cards and the scan popover's test + settings as they are; all of it is
 * per-device state, so each surface always agrees with the others.
 *
 * The customer display stays a switch in the drawer itself.
 */
export function HardwareSettingsDialog({
  storeId,
  open,
  onOpenChange,
}: HardwareSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 90dvh/app-zoom (not vh): iOS Safari's vh ignores the toolbar, and CSS
          zoom on <html> does not scale viewport units — see AGENTS.md. */}
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <HardwareSettingsBody storeId={storeId} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so the menu cache is read then, not before. */
function HardwareSettingsBody({ storeId }: { storeId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  // Cache only — never a fetch: this can open on any POS screen, offline, or for
  // a persona without the Cashier. The menu the Cashier keeps cached (and
  // persisted) is what a real scan is matched against; without it the test still
  // says whether the scanner works.
  const categories =
    queryClient.getQueryData<{ categories: PosMenuCategory[] }>(["pos", "menu", storeId])
      ?.categories ?? null;

  return (
    <>
      <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
        <DialogTitle>{t("pos.hardware.title")}</DialogTitle>
        <DialogDescription>{t("pos.hardware.dialogDesc")}</DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="printers" className="min-h-0 flex-1 gap-0">
        <div className="shrink-0 px-5 pt-3">
          <TabsList className="h-11 w-full">
            <TabsTrigger value="printers" className="min-h-10">
              <Printer aria-hidden />
              {t("pos.printers.title")}
            </TabsTrigger>
            <TabsTrigger value="scanner" className="min-h-10">
              <ScanBarcode aria-hidden />
              {t("cashierCheckout.scan.title")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Kept mounted while hidden: a half-typed label size only commits on
              blur, and a queued test print keeps its button disabled. */}
          <TabsContent
            value="printers"
            forceMount
            className="space-y-3 data-[state=inactive]:hidden"
          >
            <PrinterSettingsPanel />
          </TabsContent>
          {/* Unmounted when left, on purpose: the next visit starts from a clean
              test, and its field takes focus again for the scanner's Enter. */}
          <TabsContent value="scanner">
            <ScannerSettingsPanel categories={categories} context="device" />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
