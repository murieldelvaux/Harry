import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { tokenStorage, apiClient } from '../services/api';
import { queryKeys } from '../services/queryKeys';

export function useRealtimeSync(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let reconnectTimeout: any = null;

    async function connectSSE() {
      if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.EventSource) {
        return;
      }

      const token = await tokenStorage.getToken();
      if (!token || !isMounted) return;

      try {
        const baseURL = apiClient.defaults.baseURL || 'http://localhost:3000/api/v1';
        const cleanBase = baseURL.replace(/\/+$/, '');
        const sseUrl = `${cleanBase}/realtime/sse?token=${encodeURIComponent(token)}`;

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const es = new window.EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'HEARTBEAT') return;

            if (data.type === 'EXPENSE_CREATED' || data.type === 'SETTLEMENT_UPDATED' || data.type === 'REFETCH') {
              queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all, refetchType: 'all' });
              queryClient.invalidateQueries({ queryKey: queryKeys.household.current, refetchType: 'all' });
              queryClient.invalidateQueries({ queryKey: queryKeys.goals.all, refetchType: 'all' });
            } else if (data.type === 'GOAL_UPDATED') {
              queryClient.invalidateQueries({ queryKey: queryKeys.goals.all, refetchType: 'all' });
              queryClient.invalidateQueries({ queryKey: queryKeys.household.current, refetchType: 'all' });
            } else if (data.type === 'TASK_UPDATED') {
              queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all, refetchType: 'all' });
            } else if (data.type === 'SHOPPING_UPDATED') {
              queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.all, refetchType: 'all' });
            } else if (data.type === 'CALENDAR_UPDATED' || data.type === 'EVENT_CREATED') {
              queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all, refetchType: 'all' });
            } else if (data.type === 'NOTIFICATION_CREATED') {
              queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all, refetchType: 'all' });
            } else if (data.type === 'WORKOUT_UPDATED') {
              queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all, refetchType: 'all' });
            }
          } catch {
            // Ignora erro de parse em pacotes não-json
          }
        };

        es.onerror = () => {
          es.close();
          if (isMounted) {
            reconnectTimeout = setTimeout(connectSSE, 1500);
          }
        };
      } catch {
        // Fallback silencioso
      }
    }

    connectSSE();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, queryClient]);
}
