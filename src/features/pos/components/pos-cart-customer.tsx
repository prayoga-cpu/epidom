"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Search, UserPlus, UserRound, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api/client";
import { useDebounce } from "@/hooks/use-debounce";
import { useOnlineStatus } from "@/hooks/use-network-status";
import type { CustomerRowDto } from "@/types/api/cashier";
import { usePosCart } from "../hooks/use-pos-cart";
import {
  toCartCustomer,
  useCreateCustomer,
  useCustomerDetail,
  useCustomerSearch,
} from "../hooks/use-customers";

interface PosCartCustomerProps {
  storeId: string;
}

type Mode = "idle" | "search" | "create";

/** Debounce for the search-as-you-type input: one request per pause, not per keystroke. */
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 250;

// Messages are i18n keys, resolved with t() where they render — a zod schema
// built at module scope can't call the hook.
const newCustomerSchema = z.object({
  name: z.string().trim().min(1, "cashierCart.customer.nameRequired").max(80),
  phone: z.string().trim().max(30).optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "cashierCart.customer.emailInvalid",
    })
    .optional(),
});
type NewCustomerValues = z.infer<typeof newCustomerSchema>;

/** Seed the mini-form from what the cashier already typed into search: a phone-ish
 * string is a phone, anything with an "@" is an email, the rest is a name. */
export function prefillFromQuery(query: string): NewCustomerValues {
  const q = query.trim();
  if (!q) return { name: "", phone: "", email: "" };
  if (q.includes("@")) return { name: "", phone: "", email: q };
  if (/^[\d\s+().-]{5,}$/.test(q)) return { name: "", phone: q, email: "" };
  return { name: q, phone: "", email: "" };
}

/**
 * The optional customer on this sale, handled entirely in place — no pop-up.
 *
 * Empty by default (a walk-in needs nothing). "Add Customer" expands into a
 * search-as-you-type input; a match attaches with one tap, and "New customer"
 * flips the same block into a three-field mini-form. Once attached it collapses
 * to a chip showing who it is, their points (only if the store has loyalty) and
 * lifetime spend, with a ≥40px ✕ to detach.
 *
 * Online-only: the customer list lives on the server and isn't mirrored for
 * offline use, so offline the row is disabled with a hint rather than
 * pretending to search a cache that doesn't exist. Detaching never needs the
 * network, so an already-attached customer can always be removed.
 */
export function PosCartCustomer({ storeId }: PosCartCustomerProps) {
  const { t } = useI18n();
  // Lifetime spend is a literal amount in the store's display currency.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const online = useOnlineStatus();

  const customer = usePosCart((s) => s.customer);
  const setCustomer = usePosCart((s) => s.setCustomer);
  const loyaltyEnabled = usePosCart((s) => s.loyaltyRules?.enabled === true);

  const [mode, setMode] = useState<Mode>("idle");
  const [query, setQuery] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const debouncedQuery = useDebounce(query, CUSTOMER_SEARCH_DEBOUNCE_MS);

  const search = useCustomerSearch(storeId, debouncedQuery, mode === "search" && online);
  const createCustomer = useCreateCustomer(storeId);

  const form = useForm<NewCustomerValues>({
    resolver: zodResolver(newCustomerSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });

  // Never trust a balance that was persisted in localStorage (a cart survives a
  // reload — possibly days): re-read the customer on mount/resume and adopt the
  // fresh points, spend and contact details. The same customer id keeps any
  // points redemption in progress (see cart.setCustomer).
  const { data: fresh, error: refreshError } = useCustomerDetail(
    storeId,
    customer?.id ?? null,
    online
  );

  useEffect(() => {
    if (!fresh || !customer || fresh.id !== customer.id) return;
    const same =
      fresh.points === customer.points &&
      fresh.lifetimeSpend === customer.lifetimeSpend &&
      fresh.name === customer.name &&
      fresh.phone === customer.phone &&
      fresh.email === customer.email;
    if (!same) setCustomer(toCartCustomer(fresh));
  }, [fresh, customer, setCustomer]);

  // A 404 means the customer was deleted since this was attached — checkout
  // would reject the dangling id, so drop it now and say why.
  useEffect(() => {
    if (customer && refreshError instanceof ApiClientError && refreshError.status === 404) {
      setCustomer(null);
      toast.error(t("cashierCart.customer.gone"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshError]);

  const close = () => {
    setMode("idle");
    setQuery("");
    setDuplicate(false);
    form.reset({ name: "", phone: "", email: "" });
  };

  const attach = (row: CustomerRowDto) => {
    setCustomer(toCartCustomer(row));
    close();
  };

  const openCreate = () => {
    form.reset(prefillFromQuery(query));
    setDuplicate(false);
    setMode("create");
  };

  const handleCreate = async (values: NewCustomerValues) => {
    try {
      const created = await createCustomer.mutateAsync({
        name: values.name.trim(),
        phone: values.phone?.trim() || undefined,
        email: values.email?.trim() || undefined,
      });
      attach(created);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        // Same phone already on file: send the cashier to the existing record
        // (search by that phone) instead of leaving them at a dead end.
        setDuplicate(true);
        setQuery(values.phone?.trim() ?? "");
        setMode("search");
        return;
      }
      const message = error instanceof ApiClientError ? error.response.error.message : null;
      toast.error(message || t("cashierCart.customer.createFailed"));
    }
  };

  // ── Attached: the chip ───────────────────────────────────────────────────
  if (customer) {
    return (
      <div className="px-3 pt-3" data-testid="pos-cart-customer">
        <div className="bg-muted/40 flex items-center gap-2 rounded-md border pl-3">
          <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 py-1.5">
            <div className="truncate text-sm font-medium">{customer.name}</div>
            <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
              {loyaltyEnabled && (
                <span className="tabular-nums">
                  {t("cashierCart.customer.points").replace("{count}", String(customer.points))}
                </span>
              )}
              <span className="tabular-nums">
                {t("cashierCart.customer.lifetimeSpend").replace(
                  "{amount}",
                  formatPrice(customer.lifetimeSpend)
                )}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground h-11 w-11 shrink-0 touch-manipulation"
            onClick={() => setCustomer(null)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t("cashierCart.customer.detach")}</span>
          </Button>
        </div>
      </div>
    );
  }

  // ── Idle: the "+ Add Customer" row ───────────────────────────────────────
  if (mode === "idle") {
    return (
      <div className="px-3 pt-3" data-testid="pos-cart-customer">
        <button
          type="button"
          disabled={!online}
          onClick={() => setMode("search")}
          className="text-muted-foreground hover:text-foreground hover:border-foreground/40 flex h-11 w-full cursor-pointer touch-manipulation items-center gap-2 rounded-md border border-dashed px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60"
        >
          {/* The same profile glyph the attached-customer chip uses, so the row
              reads as "customer" at a glance and becomes that chip once picked. */}
          <UserRound className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("cashierCart.customer.add")}</span>
          {!online && (
            <span className="ml-auto truncate text-xs font-normal">
              {t("cashierCart.customer.offlineHint")}
            </span>
          )}
        </button>
      </div>
    );
  }

  // ── Expanded: search or the new-customer mini-form ───────────────────────
  return (
    <div className="px-3 pt-3" data-testid="pos-cart-customer">
      <div className="space-y-2 rounded-md border p-2">
        {mode === "search" ? (
          <>
            <div className="flex items-center gap-1">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  autoFocus
                  type="search"
                  className="h-11 pl-9"
                  placeholder={t("cashierCart.customer.searchPlaceholder")}
                  aria-label={t("cashierCart.customer.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 touch-manipulation"
                onClick={close}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">{t("common.actions.cancel")}</span>
              </Button>
            </div>

            {duplicate && (
              <p role="alert" className="text-destructive px-1 text-xs font-medium">
                {t("cashierCart.customer.duplicateHint")}
              </p>
            )}

            <CustomerResults
              customers={search.data?.customers ?? []}
              // The debounce window counts as loading too: without it the list
              // would sit on the previous query's results for a moment and look wrong.
              loading={search.isFetching || query.trim() !== debouncedQuery.trim()}
              failed={search.isError}
              loyaltyEnabled={loyaltyEnabled}
              onPick={attach}
            />

            <button
              type="button"
              onClick={openCreate}
              className="text-primary hover:bg-primary/5 flex h-11 w-full touch-manipulation items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              {t("cashierCart.customer.newCustomer")}
            </button>
          </>
        ) : (
          <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-2" noValidate>
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-sm font-semibold">{t("cashierCart.customer.newCustomer")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 touch-manipulation"
                onClick={() => setMode("search")}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">{t("common.actions.cancel")}</span>
              </Button>
            </div>
            <Field error={form.formState.errors.name?.message}>
              <Input
                autoFocus
                className="h-11"
                placeholder={t("cashierCart.customer.namePlaceholder")}
                aria-label={t("cashierCart.customer.namePlaceholder")}
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
            </Field>
            <Field error={undefined}>
              <Input
                className="h-11"
                type="tel"
                inputMode="tel"
                placeholder={t("cashierCart.customer.phonePlaceholder")}
                aria-label={t("cashierCart.customer.phonePlaceholder")}
                {...form.register("phone")}
              />
            </Field>
            <Field error={form.formState.errors.email?.message}>
              <Input
                className="h-11"
                type="email"
                inputMode="email"
                placeholder={t("cashierCart.customer.emailPlaceholder")}
                aria-label={t("cashierCart.customer.emailPlaceholder")}
                aria-invalid={!!form.formState.errors.email}
                {...form.register("email")}
              />
            </Field>
            <Button
              type="submit"
              className="h-11 w-full touch-manipulation"
              disabled={createCustomer.isPending}
            >
              {createCustomer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("cashierCart.customer.saveAndAttach")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

/** An input with its validation message underneath. Module scope on purpose: declared
 * inside PosCartCustomer it would get a new identity every render, remounting the
 * input (and dropping focus) on each keystroke. */
function Field({ error, children }: { error?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      {children}
      {error && (
        <p role="alert" className="text-destructive px-1 text-xs">
          {t(error)}
        </p>
      )}
    </div>
  );
}

interface CustomerResultsProps {
  customers: CustomerRowDto[];
  loading: boolean;
  failed: boolean;
  loyaltyEnabled: boolean;
  onPick: (customer: CustomerRowDto) => void;
}

function CustomerResults({
  customers,
  loading,
  failed,
  loyaltyEnabled,
  onPick,
}: CustomerResultsProps) {
  const { t } = useI18n();
  const rows = customers;

  if (failed && rows.length === 0) {
    return (
      <p className="text-muted-foreground px-1 py-2 text-xs">
        {t("cashierCart.customer.searchFailed")}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-1 py-2 text-xs">
        {loading ? t("cashierCart.customer.searching") : t("cashierCart.customer.noResults")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col" aria-busy={loading}>
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onPick(row)}
            className="hover:bg-accent flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
          >
            <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{row.name}</span>
              {(row.phone || row.email) && (
                <span className="text-muted-foreground block truncate text-xs">
                  {row.phone ?? row.email}
                </span>
              )}
            </span>
            {loyaltyEnabled && (
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {t("cashierCart.customer.points").replace("{count}", String(row.points))}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
