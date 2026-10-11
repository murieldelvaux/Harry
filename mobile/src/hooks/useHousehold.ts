import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiClient } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { useAuth } from './useAuth';
import {
  HouseholdDetailDto,
  CreateHouseholdDto,
  JoinHouseholdDto,
  UpdateHouseholdDto,
} from '../../../packages/shared/src';

export function useHousehold() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();

  const householdQuery = useQuery({
    queryKey: queryKeys.household.current,
    queryFn: async () => {
      const { data } = await apiClient.get<HouseholdDetailDto | null>('/household/current');
      return data;
    },
    enabled: !!user?.householdId,
    retry: false,
  });

  const createHouseholdMutation = useMutation({
    mutationFn: async (dto: CreateHouseholdDto) => {
      const { data } = await apiClient.post<HouseholdDetailDto>('/household/create', dto);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.household.current, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      router.replace('/(tabs)');
    },
  });

  const joinHouseholdMutation = useMutation({
    mutationFn: async (dto: JoinHouseholdDto) => {
      const { data } = await apiClient.post<HouseholdDetailDto>('/household/join', dto);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.household.current, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      router.replace('/(tabs)');
    },
  });

  const updateHouseholdMutation = useMutation({
    mutationFn: async (dto: UpdateHouseholdDto) => {
      const { data } = await apiClient.put<HouseholdDetailDto>('/household/current', dto);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.household.current, data);
      queryClient.setQueryData(queryKeys.auth.me, (oldUser: any) =>
        oldUser
          ? {
              ...oldUser,
              household: oldUser.household ? { ...oldUser.household, ...data } : data,
            }
          : null
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.household.current });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });

  const deleteHouseholdMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete('/household/current');
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.household.current, null);
      queryClient.setQueryData(queryKeys.auth.me, (oldUser: any) =>
        oldUser ? { ...oldUser, householdId: null, household: null } : null
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.household.current });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });

  const leaveHouseholdMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/household/leave');
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.household.current, null);
      queryClient.setQueryData(queryKeys.auth.me, (oldUser: any) =>
        oldUser ? { ...oldUser, householdId: null, household: null } : null
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.household.current });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });

  return {
    household: householdQuery.data,
    isLoading: householdQuery.isLoading,
    isRefetching: householdQuery.isRefetching,
    isError: householdQuery.isError,
    createHousehold: createHouseholdMutation.mutateAsync,
    isCreating: createHouseholdMutation.isPending,
    createError: createHouseholdMutation.error,
    joinHousehold: joinHouseholdMutation.mutateAsync,
    isJoining: joinHouseholdMutation.isPending,
    joinError: joinHouseholdMutation.error,
    updateHousehold: updateHouseholdMutation.mutateAsync,
    isUpdating: updateHouseholdMutation.isPending,
    deleteHousehold: deleteHouseholdMutation.mutateAsync,
    isDeleting: deleteHouseholdMutation.isPending,
    leaveHousehold: leaveHouseholdMutation.mutateAsync,
    isLeaving: leaveHouseholdMutation.isPending,
    refetch: householdQuery.refetch,
  };
}
