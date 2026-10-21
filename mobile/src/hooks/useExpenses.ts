import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import {
  ExpensesListResponseDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseDto,
} from '../../../packages/shared/src';

export function useExpenses(filters: {
  month?: string;
  startDate?: string;
  endDate?: string;
  scope?: string;
  type?: string;
  category?: string;
} = {}) {
  const queryClient = useQueryClient();
  const currentMonth = filters.month || new Date().toISOString().slice(0, 7);

  const expensesQuery = useQuery({
    queryKey: queryKeys.expenses.list({ ...filters, month: currentMonth }),
    queryFn: async () => {
      const { data } = await apiClient.get<ExpensesListResponseDto>('/expenses', {
        params: { ...filters, month: currentMonth },
      });
      return data;
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (dto: CreateExpenseDto) => {
      const { data } = await apiClient.post<ExpenseDto>('/expenses', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateExpenseDto }) => {
      const { data } = await apiClient.patch<ExpenseDto>(`/expenses/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
  });

  return {
    expenses: expensesQuery.data?.items || [],
    summary: expensesQuery.data?.summary || {
      myIncome: 0,
      myPrivateExpenses: 0,
      myShareOfSharedExpenses: 0,
      myTotalExpenses: 0,
      myBalance: 0,
      jointIncome: 0,
      jointExpenses: 0,
      jointBalance: 0,
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      totalPrivate: 0,
      totalShared: 0,
      userShareOfShared: 0,
      partnerPrivate: 0,
      month: currentMonth,
    },
    isLoading: expensesQuery.isLoading,
    isRefetching: expensesQuery.isRefetching,
    isError: expensesQuery.isError,
    error: expensesQuery.error,
    refetch: expensesQuery.refetch,
    createExpense: createExpenseMutation.mutateAsync,
    isCreating: createExpenseMutation.isPending,
    updateExpense: updateExpenseMutation.mutateAsync,
    isUpdating: updateExpenseMutation.isPending,
    deleteExpense: deleteExpenseMutation.mutateAsync,
    isDeleting: deleteExpenseMutation.isPending,
  };
}
