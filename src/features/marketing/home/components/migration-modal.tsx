"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { getWhatsAppOptions, whatsappHref } from "@/lib/constants/contact";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import {
  availablePaths,
  CURRENT_POS_OPTIONS,
  OUTLET_OPTIONS,
  recommend,
  type CurrentPos,
  type MigrationPath,
  type Outlets,
} from "../lib/migration";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON } from "./landing-ui";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";

const OPTION =
  "flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-left text-[15px] text-epi-cream-50 transition-colors hover:border-epi-gold-500/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

type Step = 1 | 2 | 3 | "result";

/**
 * "Already have a POS? Choose how to start": what they use, how they want to
 * start, how many outlets, then one recommendation that says what they keep,
 * what changes, and what to know. No email field: there is no lead backend
 * for it to write to.
 *
 * Opened from the hero link and from the "switch at your pace" section.
 * Escape, a tap on the backdrop and the 44px close button all close it. On a
 * phone it fills the screen, sized in dvh so the bottom never hides under the
 * browser's toolbar.
 */
export function MigrationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const trialHref = usePosTrialHref();
  const [step, setStep] = useState<Step>(1);
  const [currentPos, setCurrentPos] = useState<CurrentPos | null>(null);
  const [path, setPath] = useState<MigrationPath | null>(null);
  const [outlets, setOutlets] = useState<Outlets | null>(null);

  // Every opening starts from the first question.
  useEffect(() => {
    if (open) {
      setStep(1);
      setCurrentPos(null);
      setPath(null);
      setOutlets(null);
    }
  }, [open]);

  const hasPos = currentPos !== null && currentPos !== "none";
  const k = (key: string) => t(`redesign.landing.migration.${key}`);

  const chooseOutlets = (value: Outlets) => {
    setOutlets(value);
    setStep("result");
    if (currentPos && path) {
      trackEvent("migration_path_selected", { current_pos: currentPos, path, outlets: value });
    }
  };

  const back = () => setStep((s) => (s === "result" ? 3 : s === 3 ? 2 : 1));

  const result = currentPos && path && outlets ? recommend({ currentPos, path, outlets }) : null;
  const whatsapp = getWhatsAppOptions(locale)[0];
  const planKey = { POS: "pos", OPERATIONS: "operations", ENTERPRISE: "enterprise" } as const;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogPortal>
        {/* Above the site's floating header (z-index 60), which the stock
            DialogContent (z-50) would sit under. */}
        <DialogOverlay className="z-[70]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="bg-epi-navy-900 text-epi-cream-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[70] flex h-[calc(100dvh/var(--app-zoom,1))] w-full flex-col outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(90dvh/var(--app-zoom,1))] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:border-white/10"
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <DialogTitle className="text-epi-cream-50 text-lg font-medium">
                {k("title")}
              </DialogTitle>
              {step !== "result" ? (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn(
                          "h-1.5 w-8 rounded-full",
                          n <= step ? "bg-epi-gold-500" : "bg-white/15"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-epi-cream-50/60 text-xs">
                    {k("stepLabel").replace("{n}", String(step))}
                  </span>
                </div>
              ) : null}
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label={k("close")}
                className="text-epi-cream-50/70 hover:text-epi-cream-50 focus-visible:outline-epi-gold-300 -mt-1 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
            {step === 1 ? (
              <Question legend={k("q1")}>
                {CURRENT_POS_OPTIONS[locale].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={OPTION}
                    onClick={() => {
                      setCurrentPos(option);
                      setStep(2);
                    }}
                  >
                    {k(`pos.${option}`)}
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />
                  </button>
                ))}
              </Question>
            ) : null}

            {step === 2 ? (
              <Question legend={k("q2")}>
                {availablePaths(locale).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={OPTION}
                    onClick={() => {
                      setPath(option);
                      setStep(3);
                    }}
                  >
                    {k(`path${option}${hasPos ? "" : "NoPos"}`)}
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />
                  </button>
                ))}
              </Question>
            ) : null}

            {step === 3 ? (
              <Question legend={k("q3")}>
                {OUTLET_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={OPTION}
                    onClick={() => chooseOutlets(option)}
                  >
                    {k(`outlets.${option === "1" ? "one" : option === "2-3" ? "few" : "many"}`)}
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />
                  </button>
                ))}
              </Question>
            ) : null}

            {step === "result" && result && path ? (
              <div className="flex flex-col gap-5" data-testid="migration-result">
                <div>
                  <div className="text-epi-cream-50/55 text-xs tracking-[0.16em] uppercase">
                    {k("result.planLabel")}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="epi-display text-epi-cream-50 text-4xl leading-none">
                      {t(`redesign.landing.plans.${planKey[result.plan]}`)}
                    </span>
                  </div>
                </div>

                {result.plan === "ENTERPRISE" ? (
                  <ResultRow label={k("result.changeLabel")} text={k("result.changeEnterprise")} />
                ) : (
                  <>
                    {result.keepsTill || (path === "C" && hasPos) ? (
                      <ResultRow
                        label={k("result.keepLabel")}
                        text={result.keepsTill ? k("result.keepTill") : k("result.keepTerminal")}
                      />
                    ) : null}
                    <ResultRow
                      label={k("result.changeLabel")}
                      text={k(
                        path === "A"
                          ? onlinePaymentCopyKey("result.changeA")
                          : `result.change${path}`
                      )}
                    />
                    {path === "B" || path === "C" || result.upgradedForOutlets ? (
                      <div className="border-epi-gold-500/30 bg-epi-gold-500/[0.08] rounded-2xl border p-4">
                        <div className="text-epi-gold-300 text-xs tracking-[0.16em] uppercase">
                          {k("result.noteLabel")}
                        </div>
                        <ul className="text-epi-cream-50/85 m-0 mt-2 flex list-none flex-col gap-2 p-0 text-sm leading-relaxed">
                          {path === "B" ? <li>{k("result.noteB")}</li> : null}
                          {path === "C" ? <li>{k("result.noteC")}</li> : null}
                          {result.upgradedForOutlets ? <li>{k("result.noteOutlets")}</li> : null}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}

                {result.cta === "whatsapp" ? (
                  <a
                    href={whatsappHref(whatsapp.number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={PRIMARY_BUTTON}
                  >
                    {k("result.ctaWhatsApp")}
                  </a>
                ) : (
                  <Link
                    href={
                      result.cta === "trial"
                        ? trialHref
                        : `${getLocalizedPath("/pricing", locale)}#plans`
                    }
                    onClick={onClose}
                    className={PRIMARY_BUTTON}
                  >
                    {result.cta === "trial" ? k("result.ctaTrial") : k("result.ctaOperations")}
                  </Link>
                )}
              </div>
            ) : null}
          </div>

          {step !== 1 ? (
            <div className="flex justify-between gap-3 border-t border-white/10 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <button
                type="button"
                onClick={back}
                className="text-epi-cream-50/80 hover:text-epi-cream-50 focus-visible:outline-epi-gold-300 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm focus-visible:outline-2"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {k("back")}
              </button>
              {step === "result" ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-epi-gold-400 hover:text-epi-gold-300 focus-visible:outline-epi-gold-300 inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm focus-visible:outline-2"
                >
                  {k("restart")}
                </button>
              ) : null}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function Question({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-epi-cream-50 mb-4 text-xl font-medium">{legend}</legend>
      <div className="flex flex-col gap-2.5">{children}</div>
    </fieldset>
  );
}

function ResultRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-epi-cream-50/55 text-xs tracking-[0.16em] uppercase">{label}</div>
      <p className="text-epi-cream-50 m-0 mt-1.5 text-[15px] leading-relaxed">{text}</p>
    </div>
  );
}
