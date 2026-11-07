"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";
import {
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  type CustomerDisplaySnapshot,
} from "../lib/customer-display";
import { CustomerDisplayView } from "./customer-display-view";

export type CustomerDisplayPreviewState = "welcome" | "order" | "qris" | "thankYou";
export type CustomerDisplayPreviewOrientation = "landscape" | "portrait";

/** The size the preview is laid out at before being scaled down to fit: a
 * typical 1280×720 customer monitor (or the same, mounted upright). */
const CANVAS = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
} as const;

// Currencies with no minor unit get rupiah-sized sample prices.
const ZERO_DECIMAL = new Set(["IDR", "JPY", "KRW", "VND", "CLP", "ISK", "HUF"]);

function useSampleSnapshot(state: CustomerDisplayPreviewState): CustomerDisplaySnapshot {
  const { t } = useI18n();
  const { currency } = useCurrency();
  return useMemo(() => {
    const big = ZERO_DECIMAL.has(currency);
    const price = (whole: number, small: number) => (big ? whole : small);
    const lines = [
      {
        id: "sample-1",
        name: t("pos.customerDisplay.editor.sampleItem1"),
        quantity: 2,
        lineTotal: price(76000, 9),
        modifiers: [t("pos.customerDisplay.editor.sampleModifier")],
      },
      {
        id: "sample-2",
        name: t("pos.customerDisplay.editor.sampleItem2"),
        quantity: 1,
        lineTotal: price(28000, 3.2),
        modifiers: [],
      },
      {
        id: "sample-3",
        name: t("pos.customerDisplay.editor.sampleItem3"),
        quantity: 1,
        lineTotal: price(12000, 2),
        modifiers: [],
      },
    ];
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const tax = big ? Math.round(subtotal * 0.1) : Math.round(subtotal * 10) / 100;
    const total = subtotal + tax;

    if (state === "welcome") return { ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, updatedAt: 1 };
    if (state === "thankYou") {
      return {
        ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
        phase: "paid",
        total,
        paidOrderNumber: "A-042",
        changeDue: big ? 100000 - total : Math.round((20 - total) * 100) / 100,
        updatedAt: 1,
      };
    }
    return {
      ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
      phase: "building",
      lines,
      highlightLineId: "sample-1",
      highlightIsNew: true,
      subtotal,
      tax,
      total,
      paymentPrompt: state === "qris" ? "QRIS" : null,
      updatedAt: 1,
    };
  }, [state, currency, t]);
}

interface CustomerDisplayPreviewProps {
  config: CustomerDisplayConfig;
  state: CustomerDisplayPreviewState;
  orientation: CustomerDisplayPreviewOrientation;
  className?: string;
}

/**
 * The real CustomerDisplayView, laid out at a fixed monitor size and scaled to
 * fit — so the owner sees exactly what the customer will, before saving.
 */
export function CustomerDisplayPreview({
  config,
  state,
  orientation,
  className,
}: CustomerDisplayPreviewProps) {
  const { t } = useI18n();
  const snapshot = useSampleSnapshot(state);
  const canvas = CANVAS[orientation];
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setScale(box.offsetWidth / canvas.width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [canvas.width]);

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-black shadow-sm",
        orientation === "landscape" ? "aspect-video" : "mx-auto aspect-[9/16] max-w-[300px]",
        className
      )}
      aria-label={t("pos.customerDisplay.editor.previewLabel")}
      role="img"
    >
      {scale > 0 && (
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left select-none"
          style={{ width: canvas.width, height: canvas.height, transform: `scale(${scale})` }}
          aria-hidden
        >
          <CustomerDisplayView
            config={config}
            snapshot={snapshot}
            now={now}
            variant="preview"
            phoneCta={{ label: t("pos.customerDisplay.phoneCta"), done: false }}
          />
        </div>
      )}
    </div>
  );
}
