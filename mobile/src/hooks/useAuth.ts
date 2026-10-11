import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { authService } from '../services/auth.service';
import { queryKeys } from '../services/queryKeys';
import {
  RegisterDto,
  LoginDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from '../../../packages/shared/src';

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const userQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        return await authService.getMe();
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: (dto: LoginDto) => authService.login(dto),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me, data.user);
      queryClient.invalidateQueries();
      router.replace('/(tabs)');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (dto: RegisterDto) => authService.register(dto),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me, data.user);
      queryClient.invalidateQueries();
      router.replace('/(tabs)');
    },
  });

  const googleMutation = useMutation({
    mutationFn: (dto: GoogleAuthDto) => authService.googleAuth(dto),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.me, data.user);
      queryClient.invalidateQueries();
      router.replace('/(tabs)');
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (dto: ForgotPasswordDto) => authService.forgotPassword(dto),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (dto: ResetPasswordDto) => authService.resetPassword(dto),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (dto: UpdateProfileDto) =>
      authService.updateProfile(dto),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(queryKeys.auth.me, (old: any) => ({ ...old, ...updatedUser }));
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.household.current });
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: (phone: string) => authService.updatePhone(phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });

  const logout = async () => {
    await authService.logout();
    queryClient.clear();
    router.replace('/(auth)/login');
  };

  return {
    user: userQuery.data,
    isLoadingUser: userQuery.isLoading,
    isAuthenticated: !!userQuery.data,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    loginWithGoogle: googleMutation.mutateAsync,
    isGoogleLoading: googleMutation.isPending,
    googleError: googleMutation.error,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    isForgotPasswordLoading: forgotPasswordMutation.isPending,
    resetPassword: resetPasswordMutation.mutateAsync,
    isResetPasswordLoading: resetPasswordMutation.isPending,
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    updatePhone: updatePhoneMutation.mutateAsync,
    isUpdatingPhone: updatePhoneMutation.isPending,
    logout,
    refetchUser: userQuery.refetch,
  };
}
