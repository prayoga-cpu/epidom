"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useGuideState } from "../hooks/use-guide-state";
import { TOUR_CARD_COUNT, TOUR_CARD_IDS, TourCardBody } from "./welcome-tour-cards";

/**
 * Window event that opens the welcome tour on demand (Help → Replay tour).
 * Whoever mounts <WelcomeTourAutoOpen> listens for it — the Back Office
 * dashboard today — and claims it (preventDefault on a cancelable event), so
 * the sender can tell that no tour is mounted and navigate to one instead.
 */
export const OPEN_TOUR_EVENT = "epidom:open-tour";

/**
 * The query param that asks for the tour (?tour=1: Help → Replay the welcome
 * tour, the onboarding "Take the tour" link). An explicit ask: it opens the
 * tour whether or not it was seen, then the param is removed.
 */
export const TOUR_PARAM = "tour";

/** Dispatches OPEN_TOUR_EVENT. True when a mounted tour claimed it (and opened). */
export function openWelcomeTour(): boolean {
  if (typeof window === "undefined") return false;
  return !window.dispatchEvent(new CustomEvent(OPEN_TOUR_EVENT, { cancelable: true }));
}

interface WelcomeTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The welcome tour: a four-card carousel in a dialog ("Epidom has three
 * spaces", then Storefront, POS Mode and Back Office). No tour library — it
 * never points at page elements, so it can't break when the layout moves.
 *
 * Skip (top right), Escape, a tap outside and Done all mark the tour seen, so
 * it doesn't open by itself again; only Done counts as completed. Arrow keys
 * page through the cards.
 */
export function WelcomeTour({ open, onOpenChange }: WelcomeTourProps) {
  const { t } = useI18n();
  const { markTourSeen } = useGuideState();
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Every opening starts on the first card (adjusted while rendering, not in
  // an effect, so the old card never flashes).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep(0);
  }

  const isFirst = step === 0;
  const isLast = step === TOUR_CARD_COUNT - 1;

  const finish = (outcome: "completed" | "skipped") => {
    markTourSeen();
    trackEvent(outcome === "completed" ? "tour_completed" : "tour_skipped", { step: step + 1 });
    onOpenChange(false);
  };

  const goNext = () => setStep((current) => Math.min(current + 1, TOUR_CARD_COUNT - 1));
  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goBack();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Radix only reports closing here (Escape, a tap outside).
        if (!next) finish("skipped");
      }}
    >
      <DialogContent
        showCloseButton={false}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(event) => {
          // Land on Next, not on Skip — Enter walks the tour.
          event.preventDefault();
          nextRef.current?.focus();
        }}
        className="flex max-h-[calc(92dvh/var(--app-zoom,1))] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 py-1 pr-2 pl-4 sm:pl-5">
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {t("setupGuide.tour.stepOf")
              .replace("{current}", String(step + 1))
              .replace("{total}", String(TOUR_CARD_COUNT))}
          </span>
          {isLast ? (
            // Keeps the row's height once Skip gives way to Done.
            <span className="h-10" aria-hidden="true" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="h-10 min-w-10 px-3"
              onClick={() => finish("skipped")}
            >
              {t("setupGuide.tour.skip")}
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5" aria-live="polite">
          <TourCardBody card={TOUR_CARD_IDS[step]} />
        </div>

        <div className="shrink-0 border-t px-4 pt-1 pb-3 sm:px-5">
          <div role="group" aria-label={t("setupGuide.tour.steps")} className="flex justify-center">
            {TOUR_CARD_IDS.map((id, index) => {
              const current = index === step;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStep(index)}
                  aria-label={t("setupGuide.tour.goToStep").replace("{n}", String(index + 1))}
                  aria-current={current ? "step" : undefined}
                  className="focus-visible:ring-ring flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block h-2 rounded-full transition-all",
                      current ? "bg-epi-gold-500 w-6" : "bg-muted-foreground/30 w-2"
                    )}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-24"
              onClick={goBack}
              disabled={isFirst}
            >
              {t("setupGuide.tour.back")}
            </Button>
            <Button
              ref={nextRef}
              type="button"
              className="h-11 flex-1"
              onClick={isLast ? () => finish("completed") : goNext}
            >
              {isLast ? t("setupGuide.tour.done") : t("setupGuide.tour.next")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface WelcomeTourAutoOpenProps {
  /** The store's owner on their own persona — never a staff persona. Gates only the automatic open. */
  isOwner: boolean;
  /** The store is within NEW_STORE_WINDOW_DAYS of its creation. Gates only the automatic open. */
  isNewStore: boolean;
}

/**
 * Mounts the welcome tour and decides when it opens.
 *
 * - By itself: once, for the owner (not a staff persona) of a new store, when
 *   the saved guide state says the tour was never seen. A refused or failed
 *   guide-state read never opens it.
 * - On an explicit ask: ?tour=1 (Help → Replay the welcome tour, onboarding's
 *   "Take the tour") opens it for whoever reached the dashboard — the page's
 *   own access check gates that — seen or not, once per ask; the param is then
 *   removed. OPEN_TOUR_EVENT does the same in place.
 */
export function WelcomeTourAutoOpen({ isOwner, isNewStore }: WelcomeTourAutoOpenProps) {
  const [open, setOpen] = useState(false);
  const { isReady, isAvailable, tourSeen } = useGuideState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tourRequested = searchParams?.get(TOUR_PARAM) === "1";
  const autoOpened = useRef(false);
  const requestHandled = useRef(false);

  // The explicit ask. It removes the param whenever it is there (again, if
  // another URL update put it back), but opens the tour once per ask: closing
  // it must not reopen it before the URL catches up.
  useEffect(() => {
    if (!tourRequested) {
      requestHandled.current = false;
      return;
    }
    if (!requestHandled.current) {
      requestHandled.current = true;
      autoOpened.current = true;
      setOpen(true);
    }
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete(TOUR_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : (pathname ?? "/"), { scroll: false });
  }, [tourRequested, searchParams, pathname, router]);

  // The automatic open.
  useEffect(() => {
    if (autoOpened.current) return;
    if (!isOwner || !isReady || !isAvailable || tourSeen || !isNewStore) return;
    autoOpened.current = true;
    setOpen(true);
  }, [isOwner, isReady, isAvailable, tourSeen, isNewStore]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      // Tells the sender a tour is mounted here, so it doesn't navigate.
      event.preventDefault();
      autoOpened.current = true;
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, handleOpen);
  }, []);

  return <WelcomeTour open={open} onOpenChange={setOpen} />;
}
