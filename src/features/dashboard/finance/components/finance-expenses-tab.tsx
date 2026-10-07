"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DecimalInput } from "@/components/shared/decimal-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { todayLocalISO } from "@/lib/utils/date-range";
import { EXPENSE_CATEGORIES } from "@/lib/finance/expenses";
import { sharePct } from "@/lib/finance/report-totals";
import { ReportStatus, TotalsCard } from "./finance-report-parts";
import {
  useDeleteExpense,
  useFinanceExpenses,
  useSaveExpense,
} from "../hooks/use-finance-expenses";
import type { ExpenseCategory, ExpenseRow } from "../finance-types";

interface FinanceExpensesTabProps {
  storeId: string;
  rangeFrom: string;
  rangeTo: string;
  formatMoney: (value: number | null | undefined) => string;
}

interface Draft {
  id?: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number | undefined;
}

const emptyDraft = (): Draft => ({
  date: todayLocalISO(),
  category: "RENT",
  description: "",
  amount: undefined,
});

/**
 * Finance → Expenses: the operating costs the P&L subtracts from net profit
 * to reach profit after expenses — totalled, subtotalled by category, and
 * editable in place.
 */
export function FinanceExpensesTab({
  storeId,
  rangeFrom,
  rangeTo,
  formatMoney,
}: FinanceExpensesTabProps) {
  const { t, formatDayDate } = useI18n();
  const expenses = useFinanceExpenses(storeId, rangeFrom, rangeTo);
  const save = useSaveExpense(storeId);
  const remove = useDeleteExpense(storeId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);

  const categoryLabel = (category: ExpenseCategory) =>
    t(`pages.financeExpenseCategory.${category}`);
  const dayLabel = (date: string) => formatDayDate(new Date(`${date}T00:00:00`));

  const submit = async () => {
    if (!draft || !draft.date || !draft.amount || draft.amount <= 0) {
      toast.error(t("pages.financeExpenseInvalid"));
      return;
    }
    try {
      await save.mutateAsync({
        id: draft.id,
        date: draft.date,
        category: draft.category,
        // Always sent, empty included: leaving it out of a PATCH kept the old
        // text, so a description could never be cleared.
        description: draft.description.trim(),
        amount: draft.amount,
      });
      toast.success(t(draft.id ? "pages.financeExpenseUpdated" : "pages.financeExpenseAdded"));
      setDraft(null);
    } catch (error) {
      toast.error(t("pages.financeExpenseSaveError"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("pages.financeExpenseDeleted"));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(t("pages.financeExpenseSaveError"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const data = expenses.data;
  const rows = data?.expenses ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-xs">{t("pages.financeExpensesHint")}</p>
        <Button size="sm" className="h-10 shrink-0" onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("pages.financeAddExpense")}
        </Button>
      </div>

      {expenses.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : expenses.isError ? (
        <div className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
          <ReportStatus
            isError
            onRetry={() => expenses.refetch()}
            loadingLabel=""
            errorLabel={t("pages.financeExpensesLoadError")}
            retryLabel={t("common.actions.retry")}
          />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
          {t("pages.financeNoExpenses")}
        </p>
      ) : (
        <>
          {/* Subtotals by category */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(data?.byCategory ?? []).map((c) => (
              <div key={c.category} className="bg-muted/40 rounded-lg border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {categoryLabel(c.category)} · {c.count}
                </p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(c.amount)}{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    {sharePct(c.amount, total)}%
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* Phone: one card per expense, then the total */}
          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <div key={row.id} className="bg-muted/50 space-y-2 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{categoryLabel(row.category)}</p>
                    <p className="text-muted-foreground text-xs">{dayLabel(row.date)}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatMoney(row.amount)}</p>
                </div>
                {row.description && <p className="text-sm">{row.description}</p>}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDraft({ ...row, description: row.description ?? "" })}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    {t("common.actions.edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {t("common.actions.delete")}
                  </Button>
                </div>
              </div>
            ))}
            <TotalsCard
              title={t("pages.financeTotal")}
              lines={[
                ...(data?.byCategory ?? []).map((c) => ({
                  label: categoryLabel(c.category),
                  value: formatMoney(c.amount),
                })),
                {
                  label: t("pages.financeOperatingExpenses"),
                  value: formatMoney(total),
                  emphasis: "total" as const,
                },
              ]}
            />
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("pages.financeCategory")}</TableHead>
                  <TableHead>{t("pages.financeDescription")}</TableHead>
                  <TableHead className="text-right">{t("pages.financeAmount")}</TableHead>
                  <TableHead className="w-24 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {dayLabel(row.date)}
                    </TableCell>
                    <TableCell className="font-medium">{categoryLabel(row.category)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatMoney(row.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          aria-label={t("common.actions.edit")}
                          onClick={() => setDraft({ ...row, description: row.description ?? "" })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-10 w-10"
                          aria-label={t("common.actions.delete")}
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>
                    {t("pages.financeOperatingExpenses")} ({rows.length})
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(total)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}

      <Dialog open={draft != null} onOpenChange={(open) => !open && setDraft(null)}>
        {draft && (
          <FormDialogLayout
            title={t(draft.id ? "pages.financeEditExpense" : "pages.financeAddExpense")}
            description={t("pages.financeExpenseDialogDesc")}
            maxWidth="md"
            footer={
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(null)}
                  disabled={save.isPending}
                >
                  {t("common.actions.cancel")}
                </Button>
                <Button type="submit" form="expense-form" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {t("common.actions.save")}
                </Button>
              </>
            }
          >
            <form
              id="expense-form"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-date">{t("common.date")}</Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expense-amount">{t("pages.financeAmount")}</Label>
                  <DecimalInput
                    id="expense-amount"
                    value={draft.amount}
                    decimals={2}
                    min={0}
                    onChange={(amount) => setDraft({ ...draft, amount })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("pages.financeCategory")}</Label>
                <Select
                  value={draft.category}
                  onValueChange={(category) =>
                    setDraft({ ...draft, category: category as ExpenseCategory })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {categoryLabel(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expense-description">{t("pages.financeDescription")}</Label>
                <Input
                  id="expense-description"
                  value={draft.description}
                  maxLength={200}
                  placeholder={t("pages.financeExpenseDescriptionPlaceholder")}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
            </form>
          </FormDialogLayout>
        )}
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.financeDeleteExpenseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                t("pages.financeDeleteExpenseDesc")
                  .replace("{category}", categoryLabel(deleteTarget.category))
                  .replace("{amount}", formatMoney(deleteTarget.amount))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t("common.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
