import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarService, GoogleSyncResult } from '../services/calendar.service';
import { queryKeys } from '../services/queryKeys';
import {
  CalendarEventDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from '../../../packages/shared/src';

export function useCalendar(start?: string, end?: string) {
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: queryKeys.calendar.list(start, end),
    queryFn: () => calendarService.getAll(start, end),
    refetchInterval: 10000, // Polling de backup rápido a cada 10s caso Webhook/SSE oscile
    refetchIntervalInBackground: false,
  });

  const sharedCalendarsQuery = useQuery({
    queryKey: queryKeys.calendar.sharedCalendars,
    queryFn: () => calendarService.listCalendars(),
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateCalendarEventDto) => calendarService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCalendarEventDto }) =>
      calendarService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const syncGoogleMutation = useMutation({
    mutationFn: () => calendarService.syncGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  return {
    events: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    isRefetching: eventsQuery.isRefetching,
    isError: eventsQuery.isError,
    refetch: eventsQuery.refetch,
    sharedCalendars: sharedCalendarsQuery.data || [],
    isLoadingSharedCalendars: sharedCalendarsQuery.isLoading,
    refetchSharedCalendars: sharedCalendarsQuery.refetch,
    createEvent: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateEvent: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteEvent: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    syncGoogle: syncGoogleMutation.mutateAsync,
    isSyncingGoogle: syncGoogleMutation.isPending,
  };
}
