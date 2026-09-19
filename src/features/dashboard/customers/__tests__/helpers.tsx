import type { ReactElement } from "react";
import { configure, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils/formatting";
import { ApiClientError } from "@/lib/api/client";
import type { CustomerDetailDto, CustomerRowDto } from "@/types/api/cashier";

/**
 * Shared fixtures for the Customers page tests. Not a test file itself (no
 * .test suffix), so vitest does not collect it; the specs import it, and reach it
 * from inside `vi.mock` factories through a dynamic import (factories are hoisted
 * above static imports).
 */

// Every spec imports this file, so this applies to all of them. The 1s default for
// findBy*/waitFor is too tight for these renders when the whole suite runs in
// parallel (the search flows also wait out a 300ms debounce); the assertions are
// about state, not speed.
configure({ asyncUtilTimeout: 8000 });

// Keys whose value carries a {placeholder} need real text for the interpolation
// to be observable; every other key just echoes itself, like the repo's other
// component tests (`t: (k) => k`).
const TEXT: Record<string, string> = {
  "customers.adjust.balanceAfter": "Balance after: {balance} points",
  "customers.adjust.balanceNow": "New balance: {balance} points",
  "customers.adjust.errors.amountMax": "At most {max} points",
  "customers.table.showing": "Showing {shown} of {total}",
  "customers.detail.customerSince": "Customer since {date}",
  "customers.form.toasts.added": "{name} added",
  "customers.form.toasts.updated": "{name} updated",
  "customers.states.noResultsDescription": "Nothing matches “{query}”",
};

// One stable function: a fresh `t` per render would make every `useMemo([t])`
// downstream recompute, which the real provider (useCallback) never does.
const t = (key: string) => TEXT[key] ?? key;

export function mockUseI18n() {
  return { t, intlLocale: "en-US" };
}

/**
 * Mirrors the real CurrencyProvider's CONTRACT rather than stubbing it flat: a
 * value whose `fromCurrency` isn't the display currency is treated as IDR and
 * multiplied by the exchange rate. A component that forgets the second argument
 * therefore renders a visibly different (tiny) number, which is exactly the
 * shipped bug the money assertions are here to catch.
 */
export const IDR_TO_DISPLAY_RATE = 0.00006;

export function makeUseCurrency(getCurrency: () => string) {
  return () => {
    const currency = getCurrency();
    return {
      currency,
      formatPrice: (value: number | null | undefined, fromCurrency: string = "IDR") => {
        const safe = value ?? 0;
        const converted = fromCurrency === currency ? safe : safe * IDR_TO_DISPLAY_RATE;
        return formatCurrency(converted, currency, "en-US");
      },
    };
  };
}

/**
 * Stand-in for the shared PhoneInput. The real one imports phone-input.css, which
 * vitest's PostCSS config can't process (it fails the whole suite at import), and
 * its own formatting is react-phone-number-input's business. What this page
 * depends on is the CONTRACT — an <input type="tel"> whose value is E.164 or
 * `undefined` once cleared — and that is all the stub reproduces.
 */
export function PhoneInputStub({
  value,
  onChange,
  defaultCountry,
}: {
  value?: string;
  onChange?: (value: string | undefined) => void;
  defaultCountry?: string;
}) {
  return (
    <input
      type="tel"
      data-default-country={defaultCountry}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value || undefined)}
    />
  );
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const utils = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, ...utils };
}

export function makeCustomer(overrides: Partial<CustomerRowDto> = {}): CustomerRowDto {
  return {
    id: "c1",
    name: "Marie Dupont",
    phone: "+33612345678",
    email: "marie@example.com",
    notes: null,
    points: 100,
    memberSince: "2026-03-01T10:00:00.000Z",
    createdAt: "2026-01-15T10:00:00.000Z",
    lifetimeSpend: 1234.5,
    orderCount: 7,
    lastOrderAt: "2026-09-10T12:30:00.000Z",
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<CustomerDetailDto> = {}): CustomerDetailDto {
  return {
    ...makeCustomer(),
    orders: [
      {
        id: "o1",
        orderNumber: "ORD-0001",
        orderDate: "2026-09-10T12:30:00.000Z",
        total: 48.9,
        status: "DELIVERED",
      },
    ],
    loyaltyEntries: [
      {
        id: "l1",
        type: "EARN",
        points: 49,
        note: "Order ORD-0001",
        orderId: "o1",
        createdAt: "2026-09-10T12:31:00.000Z",
      },
      {
        id: "l2",
        type: "REDEEM",
        points: -20,
        note: null,
        orderId: "o0",
        createdAt: "2026-08-01T09:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

/** An API failure shaped like the real envelope, with field-level `details`. */
export function apiError(
  status: number,
  message: string,
  details?: Array<{ field: string; message: string }>
) {
  return new ApiClientError(
    { success: false, error: { code: "ERROR", message, details } } as never,
    status
  );
}
