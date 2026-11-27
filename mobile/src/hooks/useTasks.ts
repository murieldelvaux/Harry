import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { CreateTaskDto, UpdateTaskDto, TaskDto } from '../../../packages/shared/src';

export function useTasks() {
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<TaskDto[]>('/tasks');
      return data;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (dto: CreateTaskDto) => {
      const { data } = await apiClient.post<TaskDto>('/tasks', dto);
      return data;
    },
    onSuccess: async (created) => {
      queryClient.setQueryData<TaskDto[]>(queryKeys.tasks.list(), (old) =>
        old ? [created, ...old.filter((t) => t.id !== created.id)] : [created],
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<TaskDto>(`/tasks/${id}/toggle`);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateTaskDto }) => {
      const { data } = await apiClient.patch<TaskDto>(`/tasks/${id}`, dto);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });

  return {
    tasks: tasksQuery.data || [],
    isLoading: tasksQuery.isLoading,
    isRefetching: tasksQuery.isRefetching,
    isError: tasksQuery.isError,
    refetch: tasksQuery.refetch,
    createTask: createTaskMutation.mutateAsync,
    isCreating: createTaskMutation.isPending,
    updateTask: updateTaskMutation.mutateAsync,
    isUpdating: updateTaskMutation.isPending,
    toggleTask: toggleTaskMutation.mutateAsync,
    deleteTask: deleteTaskMutation.mutateAsync,
  };
}
