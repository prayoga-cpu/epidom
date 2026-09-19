"use client";

import { useMemo, useRef, useState } from "react";
import type React from "react";
import { ScanBarcode } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ScanDetector, findItemByBarcode } from "../lib/barcode";
import {
  POS_SCANNER_SPEEDS,
  SCANNER_SPEED_GAP_MS,
  usePosScannerSettings,
  type PosScannerSpeed,
} from "../hooks/use-pos-scanner-settings";

const SPEED_LABEL_KEYS: Record<PosScannerSpeed, string> = {
  standard: "cashierCheckout.scan.speedStandard",
  slow: "cashierCheckout.scan.speedSlow",
};

type TestResult =
  | { kind: "scan"; code: string; slowestGapMs: number; itemName: string | null }
  | { kind: "typed"; slowestGapMs: number };

interface PosScannerMenuProps {
  /** The menu a tested code is looked up in — the same lookup a real scan uses. */
  categories: Array<{ items: Array<{ name: string; barcode?: string | null }> }>;
  /** Extra classes for the trigger button — the status-bar layout squares and stretches it. */
  className?: string;
}

/**
 * The scan button that sits inside the POS search box: opens a small panel to
 * TEST the scanner and to change how the till listens for it.
 *
 * Test: a field that reads a scan the way the page-wide listener would (same
 * ScanDetector, same speed setting) but never touches the cart, then says what
 * it saw — the code, whether the menu has it, and how slow the slowest pause
 * between keys was. That last number is what tells a cashier whose scans get
 * missed whether to switch to the Slow setting.
 *
 * Why the test needs its own field: while any popover is open the page-wide
 * listener stands down on purpose (isOverlayOpen), so a scan can never add an
 * item behind this panel — which also means it can't be the thing reporting one.
 */
export function PosScannerMenu({ categories, className }: PosScannerMenuProps) {
  const { t } = useI18n();
  const enabled = usePosScannerSettings((s) => s.enabled);
  const speed = usePosScannerSettings((s) => s.speed);
  const setEnabled = usePosScannerSettings((s) => s.setEnabled);
  const setSpeed = usePosScannerSettings((s) => s.setSpeed);
  const maxGapMs = SCANNER_SPEED_GAP_MS[speed];

  const [value, setValue] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const detector = useMemo(() => new ScanDetector({ maxGapMs }), [maxGapMs]);
  const burst = useRef({ last: 0, slowest: 0 });

  const label = t("cashierCheckout.scan.focus");

  const handleTestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const at = e.timeStamp;
    if (e.key === "Enter") {
      e.preventDefault();
      const code = detector.feed("Enter", at);
      const slowestGapMs = Math.round(burst.current.slowest);
      burst.current = { last: 0, slowest: 0 };
      setValue("");
      if (!code) {
        setResult({ kind: "typed", slowestGapMs });
        return;
      }
      const item = findItemByBarcode(categories, code);
      setResult({ kind: "scan", code, slowestGapMs, itemName: item?.name ?? null });
      return;
    }
    // Modifiers and navigation keys are not part of a code (same rule as ScanDetector).
    if (e.key.length !== 1) return;
    if (burst.current.last) {
      burst.current.slowest = Math.max(burst.current.slowest, at - burst.current.last);
    }
    burst.current.last = at;
    detector.feed(e.key, at);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    // A stale verdict from the last visit would read as this visit's result.
    setValue("");
    setResult(null);
    detector.reset();
    burst.current = { last: 0, slowest: 0 };
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/* Sits inside the search box's right edge as one control. A full 40px
            square (the box's own height) so it stays a real tap target. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "data-[state=open]:bg-muted absolute top-0 right-0 size-10 touch-manipulation rounded-l-none border-l",
            className
          )}
          aria-label={label}
          title={label}
        >
          <ScanBarcode className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        aria-label={t("cashierCheckout.scan.title")}
        className="max-h-[calc(85dvh/var(--app-zoom,1))] w-80 space-y-4 overflow-y-auto"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("cashierCheckout.scan.testTitle")}</p>
          <p className="text-muted-foreground text-xs">{t("cashierCheckout.scan.testPrompt")}</p>
          {/* inputMode="none": a hardware scanner needs no on-screen keyboard, and
              this field takes focus the moment the panel opens. */}
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleTestKeyDown}
            inputMode="none"
            autoComplete="off"
            spellCheck={false}
            className="h-10 font-mono"
            placeholder={t("cashierCheckout.scan.testPlaceholder")}
            aria-label={t("cashierCheckout.scan.testTitle")}
          />
          <div role="status" aria-live="polite" className="min-h-10 text-sm">
            {result?.kind === "scan" && (
              <div
                className={cn(
                  "rounded-md border px-3 py-2",
                  result.itemName
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-amber-500/40 bg-amber-500/10"
                )}
              >
                <p className="font-medium">
                  {result.itemName
                    ? t("cashierCheckout.scan.testMatch").replace("{name}", result.itemName)
                    : t("cashierCheckout.scan.testNoMatch")}
                </p>
                <p className="text-muted-foreground mt-0.5 font-mono text-xs break-all">
                  {t("cashierCheckout.scan.testDetail")
                    .replace("{code}", result.code)
                    .replace("{gap}", String(result.slowestGapMs))}
                </p>
              </div>
            )}
            {result?.kind === "typed" && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <p className="font-medium">{t("cashierCheckout.scan.testTyped")}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t("cashierCheckout.scan.testTypedDetail")
                    .replace("{gap}", String(result.slowestGapMs))
                    .replace("{limit}", String(maxGapMs))}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 border-t pt-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t("cashierCheckout.scan.settingsTitle")}
          </p>

          {/* A <label>, not just a row beside the Switch: the Switch alone is only
              ~18px tall, so the whole 44px row is what makes this tappable. */}
          <label
            htmlFor="pos-scan-anywhere"
            className="flex min-h-11 cursor-pointer items-center justify-between gap-3"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {t("cashierCheckout.scan.settingEnabled")}
              </span>
              <span className="text-muted-foreground block text-xs">
                {t("cashierCheckout.scan.settingEnabledDesc")}
              </span>
            </span>
            <Switch id="pos-scan-anywhere" checked={enabled} onCheckedChange={setEnabled} />
          </label>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("cashierCheckout.scan.speedLabel")}</p>
            <div
              role="group"
              aria-label={t("cashierCheckout.scan.speedLabel")}
              className="bg-muted flex gap-0.5 rounded-lg p-0.5"
            >
              {POS_SCANNER_SPEEDS.map((option) => {
                const active = option === speed;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSpeed(option)}
                    className={cn(
                      "h-10 flex-1 rounded-md px-2 text-xs font-semibold transition active:scale-[0.97]",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(SPEED_LABEL_KEYS[option])}
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs">{t("cashierCheckout.scan.speedDesc")}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
