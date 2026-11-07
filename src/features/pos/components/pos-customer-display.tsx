"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";
import {
  useCustomerDisplaySnapshot,
  useCustomerIntakeChannel,
} from "../hooks/use-customer-display";
import { useLiveCustomerDisplayConfig } from "../hooks/use-customer-display-config";
import {
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  isCustomerDisplayStandby,
  type CustomerDisplaySnapshot,
} from "../lib/customer-display";
import { CustomerDisplayView, type CustomerDisplayPhoneCta } from "./customer-display-view";
import { PosCustomerDisplayPhone } from "./pos-customer-display-phone";
import { useFullscreen } from "@/hooks/use-fullscreen";

/** How long a till's "ask the customer" stays worth acting on while this
 * screen is on standby. A standby is retried within a few seconds (see
 * useCustomerDisplaySnapshot), so a fresh ask opens the pad as soon as the
 * till answers — an old one must not pop it open in front of a later customer. */
const ASK_FRESH_MS = 10_000;

interface PosCustomerDisplayProps {
  storeId: string;
  /** ISO-2 country for the store, used to preselect the phone dial code. */
  defaultCountry: string;
  /** Server-rendered look and banners; kept current by polling (see useLiveCustomerDisplayConfig). */
  initialConfig: CustomerDisplayConfig;
}

/** Identifies one settled order, so a re-announced "paid" isn't a new thank-you. */
function paidKeyOf(snapshot: CustomerDisplaySnapshot): string {
  return `${snapshot.paidOrderNumber ?? ""}|${snapshot.total}`;
}

interface PaidHold {
  key: string;
  snapshot: CustomerDisplaySnapshot;
  seenAt: number;
}

/**
 * The customer's side of the till — a read-only mirror of the cashier's cart,
 * meant for a second screen turned to face the customer. Everything is driven
 * by the cashier window over `useCustomerDisplaySnapshot`; the only things a
 * customer can touch are the WhatsApp receipt button and fullscreen.
 *
 * The till holds its "paid" state for a fixed 12 s. The store's own thank-you
 * length (5-60 s) is applied here, on the screen: a longer one keeps the
 * thank-you up after the till has gone idle, a shorter one drops it early.
 * Anything the till rings up next always wins at once.
 */
export function PosCustomerDisplay({
  storeId,
  defaultCountry,
  initialConfig,
}: PosCustomerDisplayProps) {
  const { t } = useI18n();
  const config = useLiveCustomerDisplayConfig(storeId, initialConfig);
  const snapshot = useCustomerDisplaySnapshot(storeId);
  const {
    status: intakeStatus,
    askedAt,
    sendPhone,
    sendDetails,
    submitDetails,
  } = useCustomerIntakeChannel(storeId);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  // Starts null and fills in on the client: seeding it with `new Date()` would
  // render a server clock that never matches the browser's on hydration.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // ── The thank-you hold ──
  const holdMs = config.settings.thankYouSeconds * 1000;
  const [paidHold, setPaidHold] = useState<PaidHold | null>(null);
  const [expiredKey, setExpiredKey] = useState<string | null>(null);
  const paidKey = snapshot.phase === "paid" ? paidKeyOf(snapshot) : null;

  useEffect(() => {
    if (snapshot.phase === "paid") {
      const key = paidKeyOf(snapshot);
      if (key === expiredKey) return;
      // Timed from when the till settled it, not from when this screen first
      // saw it: a display reopened over a sale settled minutes ago (the
      // snapshot mirror) must not replay that customer's thank-you.
      const settledAt = snapshot.updatedAt > 0 ? Math.min(Date.now(), snapshot.updatedAt) : Date.now();
      setPaidHold((current) =>
        current?.key === key ? { ...current, snapshot } : { key, snapshot, seenAt: settledAt }
      );
    } else if (snapshot.phase !== "idle") {
      // The next order started, or the till went away: the thank-you is over.
      setPaidHold(null);
    }
  }, [snapshot, expiredKey]);

  useEffect(() => {
    if (!paidHold) return;
    const expire = () => {
      setExpiredKey(paidHold.key);
      setPaidHold(null);
    };
    const remaining = paidHold.seenAt + holdMs - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = setTimeout(expire, remaining);
    return () => clearTimeout(timer);
  }, [paidHold, holdMs]);

  // A paid snapshot is shown the moment it lands (before the hold effect has
  // run, so there is no idle flash), held while the till sits idle, and
  // replaced by the idle screen once this store's thank-you time is up.
  const shown: CustomerDisplaySnapshot =
    paidKey !== null && paidKey !== expiredKey
      ? snapshot
      : paidHold && snapshot.phase === "idle"
        ? paidHold.snapshot
        : snapshot.phase === "paid"
          ? { ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, updatedAt: snapshot.updatedAt }
          : snapshot;

  const tillPaid = snapshot.phase === "paid";
  // The till said this number belongs to an existing customer: greet them on the
  // button instead of just repeating the number back.
  const member =
    submittedPhone && intakeStatus?.phone === submittedPhone && intakeStatus.match === "existing"
      ? intakeStatus
      : null;

  // One customer's number must never carry over to the next. The paid screen
  // is the handover point, so clear it there — and close the pad if it is
  // somehow still open.
  useEffect(() => {
    if (!tillPaid) return;
    setSubmittedPhone(null);
    setPhoneOpen(false);
  }, [tillPaid]);
  // Standby rather than a frozen last order — a customer must never be shown
  // a total that stopped tracking (see CustomerDisplayView for the two kinds).
  const isStandby = isCustomerDisplayStandby(snapshot.phase);

  // The cashier asked for the customer's details: open the pad for them, the
  // same one the WhatsApp button opens. Never over the till's own thank-you.
  // On standby the ask is held, not dropped: it comes from a live till, so the
  // standby is stale and about to be replaced — the pad opens the moment it
  // is. A thank-you this screen is only HOLDING (the till is already idle)
  // gives way: the cashier has moved on to the next customer.
  const handledAskRef = useRef(0);
  useEffect(() => {
    if (askedAt === 0 || handledAskRef.current === askedAt) return;
    if (tillPaid) {
      handledAskRef.current = askedAt;
      return;
    }
    if (isStandby) return;
    handledAskRef.current = askedAt;
    if (Date.now() - askedAt <= ASK_FRESH_MS) {
      if (paidHold) {
        setExpiredKey(paidHold.key);
        setPaidHold(null);
      }
      setPhoneOpen(true);
    }
  }, [askedAt, isStandby, tillPaid, paidHold]);

  const phoneCta: CustomerDisplayPhoneCta = submittedPhone
    ? {
        done: true,
        label: member
          ? member.firstName
            ? t("pos.customerDisplay.welcomeBack").replace("{name}", member.firstName)
            : t("pos.customerDisplay.welcomeBackNoName")
          : t("pos.customerDisplay.phoneSentTo").replace("{phone}", submittedPhone),
        onClick: () => setPhoneOpen(true),
      }
    : { done: false, label: t("pos.customerDisplay.phoneCta"), onClick: () => setPhoneOpen(true) };

  return (
    <CustomerDisplayView
      config={config}
      snapshot={shown}
      now={now}
      variant="screen"
      phoneCta={phoneCta}
      fullscreen={{ active: isFullscreen, onToggle: toggleFullscreen }}
    >
      <PosCustomerDisplayPhone
        open={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        defaultCountry={defaultCountry}
        submitted={submittedPhone}
        status={intakeStatus}
        onSubmitPhone={(phone) => {
          setSubmittedPhone(phone);
          sendPhone(phone);
        }}
        onSubmitDetails={sendDetails}
        onFinishDetails={submitDetails}
      />
    </CustomerDisplayView>
  );
}
