import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workoutsService } from '../services/workouts.service';
import { queryKeys } from '../services/queryKeys';
import {
  CreateWorkoutDto,
  ConnectFitnessProviderDto,
  FitnessProvider,
} from '../../../packages/shared/src';

export function useWorkouts() {
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: queryKeys.workouts.dashboard(),
    queryFn: () => workoutsService.getDashboard(),
  });

  const createWorkoutMutation = useMutation({
    mutationFn: (dto: CreateWorkoutDto) => workoutsService.createWorkout(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const connectProviderMutation = useMutation({
    mutationFn: (dto: ConnectFitnessProviderDto) =>
      workoutsService.connectProvider(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });

  const syncProviderMutation = useMutation({
    mutationFn: (provider: FitnessProvider) =>
      workoutsService.syncProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const cheerWorkoutMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      workoutsService.cheerWorkout(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const disconnectProviderMutation = useMutation({
    mutationFn: (provider: FitnessProvider) =>
      workoutsService.disconnectProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });

  const deleteWorkoutMutation = useMutation({
    mutationFn: (id: string) => workoutsService.deleteWorkout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });

  return {
    dashboard: dashboardQuery.data || null,
    workouts: dashboardQuery.data?.workouts || [],
    integrations: dashboardQuery.data?.integrations || [],
    weeklyStats: dashboardQuery.data?.weeklyStats || [],
    isLoading: dashboardQuery.isLoading,
    isRefetching: dashboardQuery.isRefetching,
    refetch: dashboardQuery.refetch,
    createWorkout: createWorkoutMutation.mutateAsync,
    isCreating: createWorkoutMutation.isPending,
    connectProvider: connectProviderMutation.mutateAsync,
    isConnecting: connectProviderMutation.isPending,
    disconnectProvider: disconnectProviderMutation.mutateAsync,
    isDisconnecting: disconnectProviderMutation.isPending,
    getStravaAuthUrl: workoutsService.getStravaAuthUrl,
    syncProvider: syncProviderMutation.mutateAsync,
    isSyncing: syncProviderMutation.isPending,
    cheerWorkout: cheerWorkoutMutation.mutateAsync,
    isCheering: cheerWorkoutMutation.isPending,
    deleteWorkout: deleteWorkoutMutation.mutateAsync,
    isDeleting: deleteWorkoutMutation.isPending,
  };
}

