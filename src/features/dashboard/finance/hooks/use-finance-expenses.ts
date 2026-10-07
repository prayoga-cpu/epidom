"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ExpenseCategory, ExpenseRow, ExpensesData } from "../finance-types";

/**
 * The Finance Expenses ledger for the report window. Shared by the P&L tab
 * (its "Operating expenses" line) and the Expenses tab, which is why both read
 * one query key and every write invalidates it.
 */

const expensesKey = (storeId: string) => ["finance-expenses", storeId] as const;

export function useFinanceExpenses(storeId: string, rangeFrom: string, rangeTo: string) {
  return useQuery({
    queryKey: [...expensesKey(storeId), rangeFrom, rangeTo],
    queryFn: () =>
      apiClient.get<ExpensesData>(
        `/stores/${storeId}/finance/expenses?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`
      ),
    // A database that hasn't had the expenses migration yet answers 500;
    // one try is enough before the tab shows its error and retry button.
    retry: 1,
  });
}

export interface ExpenseInput {
  date: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
}

export function useSaveExpense(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ExpenseInput & { id?: string }) =>
      id
        ? apiClient.patch<ExpenseRow>(`/stores/${storeId}/finance/expenses/${id}`, input)
        : apiClient.post<ExpenseRow>(`/stores/${storeId}/finance/expenses`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesKey(storeId) }),
  });
}

export function useDeleteExpense(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/stores/${storeId}/finance/expenses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesKey(storeId) }),
  });
}
