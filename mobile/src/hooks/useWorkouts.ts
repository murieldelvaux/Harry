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

  const syncGarminCalendarMutation = useMutation({
    mutationFn: (payload: { calendarUrl?: string; icsContent?: string }) =>
      workoutsService.syncGarminCalendar(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: (payload?: { calendarUrl?: string }) =>
      workoutsService.syncAll(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const syncGarminCalendarViaApiMutation = useMutation({
    mutationFn: (payload: { email?: string; password?: string; year?: number; month?: number }) =>
      workoutsService.syncGarminCalendarViaApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });

  const completeWorkoutMutation = useMutation({
    mutationFn: (id: string) => workoutsService.completeWorkout(id),
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
    syncAll: syncAllMutation.mutateAsync,
    isSyncingAll: syncAllMutation.isPending,
    syncGarminCalendar: syncGarminCalendarMutation.mutateAsync,
    isSyncingGarminCalendar: syncGarminCalendarMutation.isPending,
    syncGarminCalendarViaApi: syncGarminCalendarViaApiMutation.mutateAsync,
    isSyncingGarminCalendarViaApi: syncGarminCalendarViaApiMutation.isPending,
    completeWorkout: completeWorkoutMutation.mutateAsync,
    isCompleting: completeWorkoutMutation.isPending,
    cheerWorkout: cheerWorkoutMutation.mutateAsync,
    isCheering: cheerWorkoutMutation.isPending,
    deleteWorkout: deleteWorkoutMutation.mutateAsync,
    isDeleting: deleteWorkoutMutation.isPending,
  };
}

