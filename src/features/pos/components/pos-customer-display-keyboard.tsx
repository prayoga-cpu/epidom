"use client";

import { useState } from "react";
import { ArrowBigUp, Delete } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { onKeyPointerDown } from "@/lib/utils/key-press";

/**
 * On-screen keyboard for the customer-facing screen — the text sibling of the
 * number pad in pos-customer-display-phone.tsx, for the same reason: this
 * screen must never summon the operating system keyboard. A second-screen till
 * usually has none attached, and on a touch monitor the OS one would cover the
 * very fields it is filling.
 *
 * Two layouts. `name` capitalises the first letter of each word (with a Shift
 * key for anything else) and offers ' - . for the names that need them; `email`
 * stays lowercase, adds a digits row, and gives @ . - _ and a .com shortcut.
 * Styled with the display's own `--cfd-*` variables so it sits on the brand
 * ground rather than the dashboard's dark theme. Every key plays the shared
 * press animation (src/lib/utils/key-press.ts), and the field shows each
 * character popping in (TypedText).
 */

export type KeyboardLayout = "name" | "email";

interface PosCustomerDisplayKeyboardProps {
  layout: KeyboardLayout;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}

const DIGITS = "1234567890".split("");
const ROW_1 = "qwertyuiop".split("");
const ROW_2 = "asdfghjkl".split("");
const ROW_3 = "zxcvbnm".split("");

/** Flex-grow per key width, as literal classes so Tailwind can see them. */
const GROW = { 1: "flex-1", 2: "flex-[2]", 3: "flex-[3]", 5: "flex-[5]" } as const;
type Grow = keyof typeof GROW;

// `relative overflow-hidden` holds the press ripple (see playKeyPress).
const KEY_BASE =
  "relative flex h-11 min-w-0 touch-manipulation items-center justify-center overflow-hidden rounded-xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] text-base font-semibold transition-opacity active:opacity-60 sm:h-12 sm:text-lg";

export function PosCustomerDisplayKeyboard({
  layout,
  value,
  onChange,
  maxLength,
}: PosCustomerDisplayKeyboardProps) {
  const { t } = useI18n();
  // One-shot: Shift capitalises the next letter only, like a phone keyboard.
  const [shift, setShift] = useState(false);

  const isName = layout === "name";
  // A name starts each word capitalised without the customer asking for it.
  const autoCaps = isName && (value === "" || /[\s'-]$/.test(value));
  const upper = isName && (autoCaps || shift);

  const append = (text: string) => {
    if (value.length + text.length > maxLength) return;
    onChange(value + text);
  };

  const pressLetter = (letter: string) => {
    append(upper ? letter.toUpperCase() : letter);
    setShift(false);
  };

  const pressSpace = () => {
    // Never a leading or doubled space — nobody means one.
    if (value === "" || value.endsWith(" ")) return;
    append(" ");
  };

  const backspace = () => onChange(value.slice(0, -1));

  const letterKey = (letter: string) => (
    <button
      key={letter}
      type="button"
      onPointerDown={onKeyPointerDown}
      aria-label={letter}
      onClick={() => pressLetter(letter)}
      className={cn(KEY_BASE, GROW[1])}
    >
      {/* An element, not a bare string: see playKeyPress. */}
      <span>{upper ? letter.toUpperCase() : letter}</span>
    </button>
  );

  const digitKey = (digit: string) => (
    <button
      key={digit}
      type="button"
      onPointerDown={onKeyPointerDown}
      aria-label={digit}
      onClick={() => append(digit)}
      className={cn(KEY_BASE, GROW[1])}
    >
      <span>{digit}</span>
    </button>
  );

  const symbolKey = (symbol: string, grow: Grow = 1) => (
    <button
      key={symbol}
      type="button"
      onPointerDown={onKeyPointerDown}
      aria-label={symbol}
      onClick={() => append(symbol)}
      className={cn(KEY_BASE, GROW[grow])}
    >
      <span>{symbol}</span>
    </button>
  );

  return (
    <div className="flex w-full flex-col gap-1 sm:gap-1.5" data-testid="customer-display-keyboard">
      {!isName && <div className="flex gap-1 sm:gap-1.5">{DIGITS.map(digitKey)}</div>}

      <div className="flex gap-1 sm:gap-1.5">{ROW_1.map(letterKey)}</div>
      {/* Nine keys: indented by half a key each side so the columns line up. */}
      <div className="flex gap-1 px-[5%] sm:gap-1.5">{ROW_2.map(letterKey)}</div>
      <div className="flex gap-1 sm:gap-1.5">
        {isName ? (
          <button
            type="button"
            onPointerDown={onKeyPointerDown}
            aria-label={t("pos.customerDisplay.keyboardShift")}
            aria-pressed={shift}
            onClick={() => setShift((s) => !s)}
            className={cn(KEY_BASE, "flex-[1.5]", shift && "bg-[color:var(--cfd-panel-strong)]")}
          >
            <ArrowBigUp className="h-5 w-5" />
          </button>
        ) : (
          <div className="flex-[1.5]" aria-hidden />
        )}
        {ROW_3.map(letterKey)}
        <button
          type="button"
          onPointerDown={onKeyPointerDown}
          aria-label={t("common.actions.delete")}
          onClick={backspace}
          className={cn(KEY_BASE, "flex-[1.5]")}
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-1 sm:gap-1.5">
        {isName ? (
          <>
            {symbolKey("'")}
            {symbolKey("-")}
            <button
              type="button"
              onPointerDown={onKeyPointerDown}
              aria-label={t("pos.customerDisplay.keyboardSpace")}
              onClick={pressSpace}
              className={cn(KEY_BASE, GROW[5], "text-sm font-medium opacity-90")}
            >
              <span>{t("pos.customerDisplay.keyboardSpace")}</span>
            </button>
            {symbolKey(".")}
          </>
        ) : (
          <>
            {symbolKey("@", 2)}
            {symbolKey(".", 2)}
            {symbolKey("-", 2)}
            {symbolKey("_", 2)}
            {symbolKey(".com", 3)}
          </>
        )}
      </div>
    </div>
  );
}
