"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FlowScreen, FlowTitle } from "./flow-screen";
import { PRIMARY_BUTTON_CLASS } from "./wizard-frame";

/**
 * One question of the setup, typeform style: a big title, the answer under it,
 * and one button (Enter does the same). Remount it per question (a `key`) and
 * the title, the answer and the buttons rise in one after the other.
 */
export function QuestionShell({
  title,
  eyebrow,
  subtitle,
  children,
  onSubmit,
  submitLabel,
  submitIcon = "check",
  submitDisabled = false,
  pending = false,
  pendingLabel,
  onBack,
  backDisabled = false,
  footer,
  direction,
  hint = true,
  focusTitle = true,
  enterToSubmit = true,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  submitIcon?: "check" | "arrow" | "none";
  submitDisabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  /** Quiet links under the buttons ("Skip setup"…). */
  footer?: React.ReactNode;
  direction?: "forward" | "back";
  /** Show the "press Enter" hint beside the button (large screens). */
  hint?: boolean;
  /** Focus the title on arrival (announces the question); off when the answer field takes the focus itself. */
  focusTitle?: boolean;
  /**
   * Enter answers the question. Off for a screen with several fields whose
   * button does something big (publishing): Enter in a field then does
   * nothing, and only the button submits.
   */
  enterToSubmit?: boolean;
}) {
  const { t } = useI18n();
  const disabled = submitDisabled || pending;

  return (
    <FlowScreen direction={direction}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) onSubmit();
        }}
        // Enter moves on from anywhere in the question, as in a typeform: an
        // input submits the form by itself and a button presses itself, so
        // only the rest (the focused title, plain text) needs this.
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.defaultPrevented) return;
          const target = event.target as HTMLElement;
          if (!enterToSubmit) {
            // Stop the browser's implicit submit from a text field.
            if (target.closest("input")) event.preventDefault();
            return;
          }
          if (target.closest("input, textarea, button, a, [role='combobox'], [role='listbox']"))
            return;
          event.preventDefault();
          if (!disabled) onSubmit();
        }}
        className="flex flex-1 flex-col gap-8"
      >
        <FlowTitle eyebrow={eyebrow} subtitle={subtitle} focusOnMount={focusTitle}>
          {title}
        </FlowTitle>

        {children ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both space-y-4 delay-200 duration-500 motion-reduce:animate-none">
            {children}
          </div>
        ) : null}

        <div className="animate-in fade-in fill-mode-both mt-auto flex flex-col gap-3 pt-4 delay-300 duration-500 motion-reduce:animate-none">
          <div className="flex items-center gap-3">
            {onBack ? (
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={backDisabled || pending}
                aria-label={t("onboarding.actions.back")}
                className="h-12 rounded-xl px-4"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={disabled}
              className={cn(
                PRIMARY_BUTTON_CLASS,
                "h-12 min-w-0 flex-1 text-base sm:flex-none sm:px-8"
              )}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {pendingLabel}
                </>
              ) : (
                <>
                  {submitLabel ?? t("onboarding.flow.ok")}
                  {submitIcon === "check" ? <Check aria-hidden="true" /> : null}
                  {submitIcon === "arrow" ? <ArrowRight aria-hidden="true" /> : null}
                </>
              )}
            </Button>
            {hint && enterToSubmit ? (
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {t("onboarding.flow.enter")}
              </span>
            ) : null}
          </div>
          {footer}
        </div>
      </form>
    </FlowScreen>
  );
}

/** A quiet text button for the footer of a question ("Skip setup"). */
export function QuietButton({
  children,
  onClick,
  disabled,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground h-10 self-start rounded-lg px-2"
    >
      {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
