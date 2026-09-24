"use client";

import { useEffect, useState } from "react";
import {
  Bluetooth,
  BluetoothConnected,
  ChefHat,
  Loader2,
  Martini,
  Printer,
  Receipt,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LABEL_SIZE_LIMITS, clampMm, type LabelLanguage } from "@/lib/pwa/item-label";
import {
  PRINTER_ROLES,
  isBluetoothSupported,
  isPrinterConnected,
  type PrinterRole,
} from "@/lib/pwa/printer-connection";
import { printTestPage } from "@/lib/pwa/printer-test";
import { resolveReceiptLocale } from "@/lib/receipts/receipt-labels";
import { usePrinterSettings, type PaperWidth } from "../hooks/use-printer-settings";
import { useTogglePrinterConnection } from "../hooks/use-toggle-printer-connection";
import type { LabelScope } from "../lib/print-plan";

const ROLE_ICON: Record<PrinterRole, LucideIcon> = {
  MAIN: Receipt,
  KITCHEN: ChefHat,
  BAR: Martini,
  LABEL: Tags,
};

interface PrinterSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One card per printer role — Receipt (main), Kitchen, Bar, Label. Each is
 * paired, sized and switched on independently, and everything here is stored on
 * THIS device only (a Bluetooth pairing can't leave it).
 */
export function PrinterSettingsDialog({ open, onOpenChange }: PrinterSettingsDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 90dvh/app-zoom (not vh): iOS Safari's vh ignores the toolbar, and CSS
          zoom on <html> does not scale viewport units — see AGENTS.md. */}
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <DialogTitle>{t("pos.printers.title")}</DialogTitle>
          <DialogDescription>{t("pos.printers.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <PrinterSettingsPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The printer cards themselves — this dialog's body, and the Printers tab of
 * Hardware settings. Everything lives in the per-device printer store, so the
 * two surfaces always agree. Fragment on purpose: the caller's container spaces
 * the cards.
 */
export function PrinterSettingsPanel() {
  const { t } = useI18n();
  const supported = isBluetoothSupported();

  return (
    <>
      {!supported && (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
          {t("pos.print.bluetoothUnsupported")}
        </p>
      )}
      {PRINTER_ROLES.map((role) => (
        <PrinterRoleCard key={role} role={role} supported={supported} />
      ))}
    </>
  );
}

function PrinterRoleCard({ role, supported }: { role: PrinterRole; supported: boolean }) {
  const { t, locale } = useI18n();
  const { currency } = useCurrency();
  const settings = usePrinterSettings((s) => s.printers[role]);
  const label = usePrinterSettings((s) => s.label);
  const connected = usePrinterSettings((s) => s.connected[role]);
  const connecting = usePrinterSettings((s) => s.connecting !== null);
  const setEnabled = usePrinterSettings((s) => s.setEnabled);
  const setAutoPrint = usePrinterSettings((s) => s.setAutoPrint);
  const setPaperWidth = usePrinterSettings((s) => s.setPaperWidth);
  const toggleConnection = useTogglePrinterConnection();
  const [testing, setTesting] = useState(false);

  const Icon = ROLE_ICON[role];
  // A TSPL label printer is sized in mm, not in characters per line.
  const usesPaperWidth = !(role === "LABEL" && label.language === "TSPL");

  const handleTest = async () => {
    setTesting(true);
    try {
      if (!isPrinterConnected(role)) {
        const ok = await usePrinterSettings.getState().connect(role);
        if (!ok) {
          toast.error(
            t("pos.printers.connectFailed").replace(
              "{printer}",
              t(`pos.printers.roles.${role}.name`)
            )
          );
          return;
        }
      }
      await printTestPage(role, {
        locale: resolveReceiptLocale(locale),
        currency,
        width: settings.paperWidth,
        label: {
          language: label.language,
          paperWidth: settings.paperWidth,
          widthMm: label.widthMm,
          heightMm: label.heightMm,
          gapMm: label.gapMm,
        },
      });
      toast.success(t("pos.printers.testDone"));
    } catch (err: unknown) {
      toast.error((err as { message?: string } | null)?.message ?? t("pos.print.failed"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-semibold">{t(`pos.printers.roles.${role}.name`)}</h3>
            <p className="text-muted-foreground text-xs">{t(`pos.printers.roles.${role}.desc`)}</p>
          </div>
        </div>
        {/* The receipt printer is the till's own and can't be switched off. The
            label makes the whole 44px box the tap target, not the 18px switch. */}
        {role !== "MAIN" && (
          <label className="flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
            <Switch
              checked={settings.enabled}
              onCheckedChange={(value) => setEnabled(role, value)}
              aria-label={t("pos.printers.enable")}
            />
          </label>
        )}
      </div>

      {settings.enabled && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-xs">
              {connected ? (
                <>
                  <BluetoothConnected className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate text-emerald-600 dark:text-emerald-400">
                    {settings.deviceName
                      ? t("pos.printers.connectedAs").replace("{name}", settings.deviceName)
                      : t("pos.print.connected")}
                  </span>
                </>
              ) : (
                <>
                  <Bluetooth className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {settings.deviceName
                      ? `${t("pos.print.notConnected")} · ${t("pos.printers.lastUsed").replace("{name}", settings.deviceName)}`
                      : t("pos.print.notConnected")}
                  </span>
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {supported && (
                <Button
                  type="button"
                  size="sm"
                  className="h-10"
                  variant={connected ? "outline" : "default"}
                  onClick={() => void toggleConnection(role)}
                  disabled={connecting || testing}
                >
                  {connecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : connected ? (
                    t("pos.print.disconnect")
                  ) : (
                    t("pos.printers.connect")
                  )}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 gap-1.5"
                onClick={() => void handleTest()}
                disabled={!supported || testing || connecting}
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                {testing ? t("pos.printers.testing") : t("pos.printers.test")}
              </Button>
            </div>
          </div>

          {usesPaperWidth && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{t("pos.print.paperWidth")}</p>
              <Segmented<PaperWidth>
                value={settings.paperWidth}
                onChange={(width) => setPaperWidth(role, width)}
                options={[
                  { value: 32, label: t("pos.print.paperWidth58") },
                  { value: 48, label: t("pos.print.paperWidth80") },
                ]}
              />
            </div>
          )}

          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">
                {role === "MAIN" ? t("pos.print.autoPrint") : t("pos.printers.autoPrintTicket")}
              </span>
              <span className="text-muted-foreground block text-xs">
                {role === "MAIN"
                  ? t("pos.print.autoPrintDesc")
                  : t("pos.printers.autoPrintTicketDesc")}
              </span>
            </span>
            <Switch
              checked={settings.autoPrint}
              onCheckedChange={(value) => setAutoPrint(role, value)}
            />
          </label>

          {role === "LABEL" && <LabelOptions />}
        </div>
      )}
    </section>
  );
}

/** What is special about a label printer: its command language, its sticker size, and which lines get one. */
function LabelOptions() {
  const { t } = useI18n();
  const label = usePrinterSettings((s) => s.label);
  const setLabel = usePrinterSettings((s) => s.setLabel);

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t("pos.printers.label.language")}</p>
          <Segmented<LabelLanguage>
            value={label.language}
            onChange={(language) => setLabel({ language })}
            options={[
              { value: "ESCPOS", label: "ESC/POS" },
              { value: "TSPL", label: "TSPL" },
            ]}
          />
        </div>
        <p className="text-muted-foreground text-xs">{t("pos.printers.label.languageHint")}</p>
      </div>

      {label.language === "TSPL" && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("pos.printers.label.size")}</p>
          <div className="grid grid-cols-3 gap-2">
            <MmInput
              id="label-width"
              label={t("pos.printers.label.width")}
              unit={t("pos.printers.label.mm")}
              value={label.widthMm}
              limits={LABEL_SIZE_LIMITS.widthMm}
              onCommit={(widthMm) => setLabel({ widthMm })}
            />
            <MmInput
              id="label-height"
              label={t("pos.printers.label.height")}
              unit={t("pos.printers.label.mm")}
              value={label.heightMm}
              limits={LABEL_SIZE_LIMITS.heightMm}
              onCommit={(heightMm) => setLabel({ heightMm })}
            />
            <MmInput
              id="label-gap"
              label={t("pos.printers.label.gap")}
              unit={t("pos.printers.label.mm")}
              value={label.gapMm}
              limits={LABEL_SIZE_LIMITS.gapMm}
              onCommit={(gapMm) => setLabel({ gapMm })}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t("pos.printers.label.scope")}</p>
        <Segmented<LabelScope>
          value={label.scope}
          onChange={(scope) => setLabel({ scope })}
          options={[
            { value: "ALL", label: t("pos.printers.label.scopeAll") },
            { value: "KITCHEN", label: t("pos.printers.label.scopeKitchen") },
            { value: "BAR", label: t("pos.printers.label.scopeBar") },
          ]}
        />
      </div>

      <p className="text-muted-foreground text-xs">{t("pos.printers.label.untested")}</p>
    </div>
  );
}

/** A row of mutually-exclusive buttons — the same control the paper-size picker has always been. */
function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <Button
          key={String(option.value)}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
          className="h-10 px-3"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * A millimetre field that keeps what is being typed as text and only commits a
 * CLAMPED number on blur / Enter — clamping on every keystroke would turn "40"
 * into "20" the moment the first digit is typed.
 */
function MmInput({
  id,
  label,
  unit,
  value,
  limits,
  onCommit,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  limits: { min: number; max: number };
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const next = clampMm(Number(draft), limits);
    setDraft(String(next));
    onCommit(next);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label} ({unit})
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={limits.min}
        max={limits.max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="h-10"
      />
    </div>
  );
}
