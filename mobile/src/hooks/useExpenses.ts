import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import {
  ExpensesListResponseDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseDto,
  SettlementPreviewDto,
  SettlementDto,
  CreateSettlementDto,
  ExpenseAnalyticsDto,
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
    mutationFn: async (arg: string | { id: string; deleteAll?: boolean }) => {
      const id = typeof arg === 'string' ? arg : arg.id;
      const deleteAll = typeof arg === 'object' ? arg.deleteAll : false;
      await apiClient.delete(`/expenses/${id}`, {
        params: deleteAll ? { deleteAll: 'true' } : undefined,
      });
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

export function useExpenseSettlements(params: {
  month?: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const enabled = params.enabled !== false;

  const previewQuery = useQuery({
    queryKey: queryKeys.expenses.settlementPreview(
      params.startDate || params.month,
      params.endDate,
    ),
    queryFn: async () => {
      const { data } = await apiClient.get<SettlementPreviewDto>(
        '/expenses/settlements/preview',
        {
          params: {
            month: params.month,
            startDate: params.startDate,
            endDate: params.endDate,
          },
        },
      );
      return data;
    },
    enabled,
  });

  const settlementsQuery = useQuery({
    queryKey: queryKeys.expenses.settlements(),
    queryFn: async () => {
      const { data } = await apiClient.get<SettlementDto[]>('/expenses/settlements');
      return data;
    },
    enabled,
  });

  const createSettlementMutation = useMutation({
    mutationFn: async (dto: CreateSettlementDto) => {
      const { data } = await apiClient.post<SettlementDto>(
        '/expenses/settlements',
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<SettlementDto>(
        `/expenses/settlements/${id}/settle`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ success: boolean }>(
        `/expenses/settlements/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
  });

  return {
    preview: previewQuery.data || null,
    isLoadingPreview: previewQuery.isLoading,
    settlements: settlementsQuery.data || [],
    isLoadingSettlements: settlementsQuery.isLoading,
    createSettlement: createSettlementMutation.mutateAsync,
    isCreatingSettlement: createSettlementMutation.isPending,
    settleAccountClosing: settleMutation.mutateAsync,
    isSettling: settleMutation.isPending,
    reopenSettlement: reopenMutation.mutateAsync,
    isReopening: reopenMutation.isPending,
  };
}

export function useExpenseAnalytics(params: {
  month?: string;
  startDate?: string;
  endDate?: string;
  scope?: string;
  enabled?: boolean;
}) {
  const enabled = params.enabled !== false;

  const analyticsQuery = useQuery({
    queryKey: queryKeys.expenses.analytics(
      params.startDate || params.month,
      params.endDate,
    ),
    queryFn: async () => {
      const { data } = await apiClient.get<ExpenseAnalyticsDto>(
        '/expenses/analytics',
        {
          params: {
            month: params.month,
            startDate: params.startDate,
            endDate: params.endDate,
            scope: params.scope,
          },
        },
      );
      return data;
    },
    enabled,
  });

  return {
    analytics: analyticsQuery.data || null,
    isLoadingAnalytics: analyticsQuery.isLoading,
    refetchAnalytics: analyticsQuery.refetch,
  };
}
