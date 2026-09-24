"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_DETAILS_EMAIL_MAX,
  CUSTOMER_DETAILS_NAME_MAX,
  isPlausibleEmail,
} from "../lib/customer-display";
import { PosCustomerDisplayKeyboard, type KeyboardLayout } from "./pos-customer-display-keyboard";
import { TypedText } from "./typed-text";

/**
 * The optional third step of the customer's number entry: a new customer may
 * leave their name and email. Both are optional and both are typed on the
 * on-screen keyboard — the fields are buttons that pick which one the keyboard
 * is filling, never real inputs, so the OS keyboard cannot appear.
 */

interface PosCustomerDisplayDetailsProps {
  name: string;
  email: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-5 w-px animate-pulse bg-current align-middle"
    />
  );
}

export function PosCustomerDisplayDetails({
  name,
  email,
  onNameChange,
  onEmailChange,
}: PosCustomerDisplayDetailsProps) {
  const { t } = useI18n();
  const [active, setActive] = useState<KeyboardLayout>("name");

  // Shown only once the customer has moved off the field — nagging mid-word
  // about an address that simply isn't finished yet would be wrong.
  const emailInvalid = email !== "" && !isPlausibleEmail(email);
  const showEmailHint = emailInvalid && active !== "email";

  const field = (id: KeyboardLayout, label: string, value: string, placeholder: string) => (
    <button
      type="button"
      onClick={() => setActive(id)}
      aria-pressed={active === id}
      className={cn(
        "flex min-h-14 w-full touch-manipulation flex-col items-start justify-center rounded-2xl border px-4 py-2 text-left transition-colors",
        active === id
          ? "border-[color:var(--cfd-ink)] bg-[color:var(--cfd-panel-strong)]"
          : "border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)]"
      )}
    >
      <span className="text-xs font-medium tracking-wide uppercase opacity-60">
        {label} · {t("pos.customerDisplay.detailsOptional")}
      </span>
      <span className="w-full truncate text-lg font-semibold sm:text-xl">
        {/* Mounted even while empty, so the very first letter pops in too. */}
        <TypedText value={value} />
        {!value && <span className="opacity-35">{placeholder}</span>}
        {active === id && <Caret />}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {field("name", t("pos.customerDisplay.detailsNameLabel"), name, "Jane Baker")}
        {field("email", t("pos.customerDisplay.detailsEmailLabel"), email, "jane@example.com")}
        {showEmailHint && (
          <p role="alert" className="px-1 text-sm font-medium">
            {t("pos.customerDisplay.detailsEmailInvalid")}
          </p>
        )}
      </div>

      <PosCustomerDisplayKeyboard
        layout={active}
        value={active === "name" ? name : email}
        onChange={active === "name" ? onNameChange : onEmailChange}
        maxLength={active === "name" ? CUSTOMER_DETAILS_NAME_MAX : CUSTOMER_DETAILS_EMAIL_MAX}
      />
    </div>
  );
}
