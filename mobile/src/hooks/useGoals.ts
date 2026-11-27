import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { CreateGoalDto, UpdateGoalProgressDto, UpdateGoalDto, GoalDto } from '../../../packages/shared/src';

export function useGoals() {
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<GoalDto[]>('/goals');
      return data;
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async (dto: CreateGoalDto) => {
      const { data } = await apiClient.post<GoalDto>('/goals', dto);
      return data;
    },
    onSuccess: async (created) => {
      queryClient.setQueryData<GoalDto[]>(queryKeys.goals.list(), (old) =>
        old ? [created, ...old.filter((g) => g.id !== created.id)] : [created],
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.goals.all });
    },
  });

  const addProgressMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateGoalProgressDto }) => {
      const { data } = await apiClient.post<GoalDto>(`/goals/${id}/progress`, dto);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.goals.all });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateGoalDto }) => {
      const { data } = await apiClient.patch<GoalDto>(`/goals/${id}`, dto);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.goals.all });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all });
    },
  });

  return {
    goals: goalsQuery.data || [],
    isLoading: goalsQuery.isLoading,
    isRefetching: goalsQuery.isRefetching,
    isError: goalsQuery.isError,
    refetch: goalsQuery.refetch,
    createGoal: createGoalMutation.mutateAsync,
    isCreating: createGoalMutation.isPending,
    addProgress: addProgressMutation.mutateAsync,
    isAddingProgress: addProgressMutation.isPending,
    updateGoal: updateGoalMutation.mutateAsync,
    isUpdating: updateGoalMutation.isPending,
    deleteGoal: deleteGoalMutation.mutateAsync,
  };
}
