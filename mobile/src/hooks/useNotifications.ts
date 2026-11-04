import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notification.service';
import { queryKeys } from '../services/queryKeys';
import { NotificationPreferenceDto } from '@harry/shared';

export function useNotifications(enabled: boolean = true) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => notificationService.listNotifications(),
    enabled,
    refetchInterval: 30000,
  });

  const preferencesQuery = useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => notificationService.getPreferences(),
    enabled,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (prefs: NotificationPreferenceDto[]) =>
      notificationService.updatePreferences(prefs),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.notifications.preferences(), updated);
    },
  });

  return {
    notifications: notificationsQuery.data?.items || [],
    unreadCount: notificationsQuery.data?.unreadCount || 0,
    isLoading: notificationsQuery.isLoading,
    refetch: notificationsQuery.refetch,
    preferences: preferencesQuery.data || [],
    isLoadingPreferences: preferencesQuery.isLoading,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAllRead: markAllAsReadMutation.isPending,
    updatePreferences: updatePreferencesMutation.mutateAsync,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
  };
}

