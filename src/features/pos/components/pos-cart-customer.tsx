"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Search, UserPlus, UserRound, Users, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/lib/api/client";
import { useDebounce } from "@/hooks/use-debounce";
import { useOnlineStatus } from "@/hooks/use-network-status";
import type { CustomerRowDto } from "@/types/api/cashier";
import { usePosCart } from "../hooks/use-pos-cart";
import { useCustomerIntake } from "../hooks/use-customer-display";
import { formatPax } from "../lib/cart-format";
import { GuestCountPicker } from "./guest-count-picker";
import { PosCustomerDisplayCard } from "./pos-customer-display-card";
import { TablePicker } from "./table-picker";
import {
  toCartCustomer,
  useCreateCustomer,
  useCustomerDetail,
  useCustomerSearch,
} from "../hooks/use-customers";

interface PosCartCustomerProps {
  storeId: string;
}

/** What the dialog's customer section shows while nobody is attached. */
type Mode = "search" | "create";

/** Debounce for the search-as-you-type input: one request per pause, not per keystroke. */
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 250;

// Messages are i18n keys, resolved with t() where they render — a zod schema
// built at module scope can't call the hook.
//
// Phone-first: a customer is identified by their WhatsApp number, and the name
// and email are optional extras (the customer screen asks for them, and they may
// decline). One of name / number is still required — a record with neither
// identifies nobody.
const newCustomerSchema = z
  .object({
    name: z.string().trim().max(100),
    phone: z.string().trim().max(30).optional(),
    email: z
      .string()
      .trim()
      .max(254)
      .refine((v) => v === "" || z.string().email().safeParse(v).success, {
        message: "cashierCart.customer.emailInvalid",
      })
      .optional(),
  })
  .refine((v) => v.name !== "" || !!v.phone, {
    message: "cashierCart.customer.nameOrPhoneRequired",
    path: ["phone"],
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
 * The customer row of the cart, and the dialog behind it.
 *
 * The row reads "Add Customer" (or the attached customer's name, points and
 * lifetime spend, with a ≥40px ✕ to detach) and, for a dine-in sale, the pax
 * and table. Tapping it opens one dialog holding everything about who the sale
 * is for:
 *   1. Pax (dine-in only), by −/+ stepper or by a row of numbers — the cashier
 *      toggles which (GuestCountPicker) — plus the optional table.
 *   2. The optional customer: search-as-you-type, a match attaches with one tap,
 *      and "New customer" flips the same section into a three-field form.
 * Picking a customer does not close the dialog (the cashier may still be on the
 * pax); Done or a tap outside does.
 *
 * Customer search is online-only: the list lives on the server and isn't
 * mirrored for offline use, so offline that section shows a hint rather than
 * pretending to search a cache that doesn't exist. Pax, table and detaching
 * never need the network.
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
  const orderType = usePosCart((s) => s.orderType);
  const guestCount = usePosCart((s) => s.guestCount);
  const tableNumber = usePosCart((s) => s.tableNumber);
  const setGuestCount = usePosCart((s) => s.setGuestCount);
  const setTableNumber = usePosCart((s) => s.setTableNumber);
  const tableId = usePosCart((s) => s.tableId);
  const setTable = usePosCart((s) => s.setTable);
  const isDineIn = orderType === "DINE_IN";

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const debouncedQuery = useDebounce(query, CUSTOMER_SEARCH_DEBOUNCE_MS);

  const search = useCustomerSearch(
    storeId,
    debouncedQuery,
    open && !customer && mode === "search" && online
  );
  const createCustomer = useCreateCustomer(storeId);

  const form = useForm<NewCustomerValues>({
    resolver: zodResolver(newCustomerSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });

  // ── Synced with the customer screen ──────────────────────────────────────
  // A customer who typed their number on the customer-facing screen and turned
  // out to be new has their number (and, live, the optional name / email they go
  // on to type) land in this same new-customer form, so the cashier can watch it
  // fill in. When the customer presses Done the till saves and attaches them on
  // its own (useCustomerIntakeResolver) — no Save tap needed. Typing in the form
  // or dismissing it takes it over: then it is the cashier's to save.
  const intakePhone = useCustomerIntake((s) => s.phone);
  const intakeMatch = useCustomerIntake((s) => s.match);
  const intakeName = useCustomerIntake((s) => s.name);
  const intakeEmail = useCustomerIntake((s) => s.email);
  const intakeReceivedAt = useCustomerIntake((s) => s.receivedAt);
  const formOpenedFor = useCustomerIntake((s) => s.formOpenedFor);
  const autoSave = useCustomerIntake((s) => s.autoSave);
  const [fromDisplay, setFromDisplay] = useState(false);
  /** Fields the cashier has typed in themselves — the customer's live typing never overwrites these. */
  const touched = useRef(new Set<string>());
  const queryClient = useQueryClient();

  /** The customer screen's form is the cashier's now: the till won't save it for them. */
  const takeOverFromDisplay = () => {
    const intake = useCustomerIntake.getState();
    intake.markTakenOver(intake.receivedAt);
  };
  /** The cashier typed in a field. On the customer screen's form, that takes it over. */
  const touch = (field: string) => {
    touched.current.add(field);
    if (fromDisplay) takeOverFromDisplay();
  };

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

  // A number arrived from the customer screen and isn't on file: prepare the
  // new-customer form with it, once per submission. Not while someone is
  // attached (nothing to create), and not again for a submission the cashier
  // already dealt with. The dialog is NOT opened for them — that would pull
  // focus off whatever they are in the middle of; the row asks them to review
  // it instead, and an already-open dialog switches to the form in place.
  useEffect(() => {
    if (customer || !intakePhone || intakeMatch !== "new") return;
    if (intakeReceivedAt === formOpenedFor) return;
    useCustomerIntake.getState().markFormOpened(intakeReceivedAt);
    setFromDisplay(true);
    setDuplicate(false);
    if (mode === "create") {
      // Already filling the form in: only complete what the cashier hasn't touched.
      if (!touched.current.has("phone")) form.setValue("phone", intakePhone);
      return;
    }
    touched.current.clear();
    form.reset({ phone: intakePhone, name: intakeName, email: intakeEmail });
    setQuery("");
    setMode("create");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, intakePhone, intakeMatch, intakeReceivedAt, formOpenedFor]);

  // The till saved the customer screen's submission and attached them: the form
  // that was waiting for it is done with (and must not reappear on detach).
  useEffect(() => {
    if (customer && mode === "create") resetCustomerSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  // A customer saved behind the picker's back must show up in its next search.
  useEffect(() => {
    if (autoSave === "saved") {
      queryClient.invalidateQueries({ queryKey: ["pos", "customers", storeId, "search"] });
    }
  }, [autoSave, queryClient, storeId]);

  // Then follow what the customer types, field by field, for as long as the
  // cashier hasn't taken a field over.
  useEffect(() => {
    if (mode !== "create" || !fromDisplay) return;
    if (!touched.current.has("name") && form.getValues("name") !== intakeName) {
      form.setValue("name", intakeName);
    }
    if (!touched.current.has("email") && form.getValues("email") !== intakeEmail) {
      form.setValue("email", intakeEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fromDisplay, intakeName, intakeEmail]);

  /** Back to an empty search — after attaching, or when the dialog closes. */
  const resetCustomerSection = () => {
    setMode("search");
    setQuery("");
    setDuplicate(false);
    setFromDisplay(false);
    touched.current.clear();
    form.reset({ name: "", phone: "", email: "" });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Closing without saving drops a half-filled form, including one the
    // customer screen started; its submission stays marked as handled.
    if (!next) resetCustomerSection();
  };

  const attach = (row: CustomerRowDto) => {
    setCustomer(toCartCustomer(row));
    resetCustomerSection();
  };

  const openCreate = () => {
    touched.current.clear();
    setFromDisplay(false);
    form.reset(prefillFromQuery(query));
    setDuplicate(false);
    setMode("create");
  };

  const handleCreate = async (values: NewCustomerValues) => {
    try {
      const created = await createCustomer.mutateAsync({
        // Optional: a customer given only a number is named after it server-side.
        name: values.name.trim() || undefined,
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

  const paxSummary = isDineIn
    ? [
        formatPax(t, guestCount),
        tableNumber.trim()
          ? t("cashierCart.header.tableShort").replace("{table}", tableNumber.trim())
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const reviewPending = !customer && mode === "create" && fromDisplay;

  const paxBadge = paxSummary && (
    <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1 text-xs font-normal tabular-nums">
      <Users className="h-3.5 w-3.5" />
      {paxSummary}
    </span>
  );

  // ── The row ──────────────────────────────────────────────────────────────
  const row = customer ? (
    <div className="bg-muted/40 flex items-center gap-2 rounded-md border">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer touch-manipulation items-center gap-2 py-1.5 pl-3 text-left"
      >
        <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{customer.name}</span>
          <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
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
          </span>
        </span>
        {paxBadge}
      </button>
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
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "flex h-11 w-full cursor-pointer touch-manipulation items-center gap-2 rounded-md border border-dashed px-3 text-sm font-medium transition-colors",
        reviewPending
          ? "border-primary text-primary bg-primary/5 border-solid"
          : "text-muted-foreground hover:text-foreground hover:border-foreground/40"
      )}
    >
      {/* The same profile glyph the attached-customer chip uses, so the row
          reads as "customer" at a glance and becomes that chip once picked. */}
      {reviewPending ? (
        <UserPlus className="h-4 w-4 shrink-0" />
      ) : (
        <UserRound className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">
        {reviewPending
          ? t("cashierCart.customer.reviewFromDisplay")
          : t("cashierCart.customer.add")}
      </span>
      {paxBadge}
    </button>
  );

  return (
    <div className="px-3 pt-3" data-testid="pos-cart-customer">
      {row}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <FormDialogLayout
          title={t(
            isDineIn
              ? "cashierCart.customerDialog.title"
              : "cashierCart.customerDialog.titleNoGuests"
          )}
          maxWidth="md"
          contentClassName="space-y-5"
          footer={
            <Button
              type="button"
              className="h-11 touch-manipulation sm:min-w-28"
              onClick={() => handleOpenChange(false)}
            >
              {t("cashierCart.customerDialog.done")}
            </Button>
          }
        >
          {isDineIn && (
            <section className="space-y-3">
              <GuestCountPicker idPrefix="cart" value={guestCount} onChange={setGuestCount} />
              <TablePicker
                storeId={storeId}
                idPrefix="cart"
                tableId={tableId}
                tableNumber={tableNumber}
                onPick={setTable}
                onCustom={setTableNumber}
              />
            </section>
          )}

          <section className={cn("space-y-2", isDineIn && "border-t pt-4")}>
            <h3 className="text-sm font-semibold">
              {t("cashierCart.customerDialog.customerHeading")}
            </h3>
            <PosCustomerDisplayCard storeId={storeId} hasCustomer={!!customer} />
            {customer ? (
              <div className="bg-muted/40 flex items-center gap-2 rounded-md border pl-3">
                <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1 py-1.5">
                  <div className="truncate text-sm font-medium">{customer.name}</div>
                  {(customer.phone || customer.email) && (
                    <div className="text-muted-foreground truncate text-xs">
                      {customer.phone ?? customer.email}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground h-11 shrink-0 touch-manipulation"
                  onClick={() => setCustomer(null)}
                >
                  <X className="h-4 w-4" />
                  {t("cashierCart.customerDialog.remove")}
                </Button>
              </div>
            ) : !online ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
                {t("cashierCart.customer.offlineHint")}
              </p>
            ) : mode === "search" ? (
              <>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  {/* No autoFocus: on an iPad it would raise the keyboard over
                      the pax picker the cashier opened this for. */}
                  <Input
                    type="search"
                    className="h-11 pl-9"
                    placeholder={t("cashierCart.customer.searchPlaceholder")}
                    aria-label={t("cashierCart.customer.searchPlaceholder")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
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
              <form
                onSubmit={form.handleSubmit(handleCreate)}
                className="space-y-2 rounded-md border p-2"
                noValidate
              >
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-sm font-semibold">
                    {t("cashierCart.customer.newCustomer")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 touch-manipulation"
                    onClick={() => {
                      // Dismissing the customer screen's form is a "no" to saving it.
                      if (fromDisplay) takeOverFromDisplay();
                      setMode("search");
                    }}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">{t("common.actions.cancel")}</span>
                  </Button>
                </div>
                {fromDisplay && (
                  <p className="text-muted-foreground px-1 text-xs">
                    {t("cashierCart.customer.fromDisplay")}
                  </p>
                )}
                <Field error={form.formState.errors.phone?.message}>
                  <Input
                    // Not when the customer screen started this: the cashier
                    // is reviewing what the customer typed, not typing.
                    autoFocus={!fromDisplay}
                    className="h-11"
                    type="tel"
                    inputMode="tel"
                    placeholder={t("cashierCart.customer.whatsappPlaceholder")}
                    aria-label={t("cashierCart.customer.whatsappPlaceholder")}
                    aria-invalid={!!form.formState.errors.phone}
                    {...form.register("phone", { onChange: () => touch("phone") })}
                  />
                </Field>
                <Field error={form.formState.errors.name?.message}>
                  <Input
                    className="h-11"
                    placeholder={t("cashierCart.customer.nameOptionalPlaceholder")}
                    aria-label={t("cashierCart.customer.nameOptionalPlaceholder")}
                    aria-invalid={!!form.formState.errors.name}
                    {...form.register("name", { onChange: () => touch("name") })}
                  />
                </Field>
                <Field error={form.formState.errors.email?.message}>
                  <Input
                    className="h-11"
                    type="email"
                    inputMode="email"
                    placeholder={t("cashierCart.customer.emailOptionalPlaceholder")}
                    aria-label={t("cashierCart.customer.emailOptionalPlaceholder")}
                    aria-invalid={!!form.formState.errors.email}
                    {...form.register("email", { onChange: () => touch("email") })}
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
          </section>
        </FormDialogLayout>
      </Dialog>
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
