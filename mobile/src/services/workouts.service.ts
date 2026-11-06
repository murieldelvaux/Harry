import { apiClient } from './api';
import {
  CreateWorkoutDto,
  ConnectFitnessProviderDto,
  WorkoutActivityDto,
  FitnessIntegrationDto,
  FitnessProvider,
} from '../../../packages/shared/src';

export interface PartnerWeeklyStatsDto {
  userId: string;
  userName: string;
  workoutCount: number;
  plannedWorkoutsCount?: number;
  runningWorkouts: number;
  strengthWorkouts: number;
  totalRunningKm: number;
  plannedRunningKm?: number;
  totalDurationMinutes: number;
  totalStrengthVolumeKg: number;
  totalStrengthSets: number;
  activeDaysCount: number;
  weeklyGoalTarget: number;
}

export interface CoupleWorkoutDashboardDto {
  workouts: WorkoutActivityDto[];
  integrations: FitnessIntegrationDto[];
  weeklyStats: PartnerWeeklyStatsDto[];
  coupleTotalWorkoutsWeek: number;
  coupleTotalRunningKmWeek: number;
  coupleTotalStrengthVolumeWeek: number;
}

export const workoutsService = {
  async getDashboard(): Promise<CoupleWorkoutDashboardDto> {
    const { data } = await apiClient.get<CoupleWorkoutDashboardDto>('/workouts');
    return data;
  },

  async createWorkout(dto: CreateWorkoutDto): Promise<WorkoutActivityDto> {
    const { data } = await apiClient.post<WorkoutActivityDto>('/workouts', dto);
    return data;
  },

  async getStravaAuthUrl(clientId?: string): Promise<{
    authUrl: string;
    clientId: string;
    redirectUri: string;
    isConfigured: boolean;
  }> {
    const { data } = await apiClient.get('/workouts/integrations/strava/auth-url', {
      params: clientId ? { clientId } : undefined,
    });
    return data;
  },

  async connectProvider(dto: ConnectFitnessProviderDto): Promise<FitnessIntegrationDto> {
    const { data } = await apiClient.post<FitnessIntegrationDto>(
      '/workouts/integrations/connect',
      dto,
    );
    return data;
  },

  async syncProvider(provider: FitnessProvider): Promise<{
    syncedCount: number;
    provider: FitnessProvider;
    workouts: WorkoutActivityDto[];
    lastSyncedAt: string;
  }> {
    const { data } = await apiClient.post('/workouts/integrations/sync', {
      provider,
    });
    return data;
  },

  async syncAll(payload?: { calendarUrl?: string }): Promise<{
    success: boolean;
    syncedCount: number;
    message: string;
    dashboard: CoupleWorkoutDashboardDto;
  }> {
    const { data } = await apiClient.post('/workouts/integrations/sync-all', payload || {});
    return data;
  },

  async syncGarminCalendar(payload: {
    calendarUrl?: string;
    icsContent?: string;
  }): Promise<{
    syncedCount: number;
    provider: FitnessProvider;
    workouts: WorkoutActivityDto[];
    message: string;
  }> {
    const { data } = await apiClient.post(
      '/workouts/integrations/garmin/calendar',
      payload,
    );
    return data;
  },

  async syncGarminCalendarViaApi(payload: {
    email?: string;
    password?: string;
    year?: number;
    month?: number;
  }): Promise<{
    syncedCount: number;
    provider: FitnessProvider;
    workouts: WorkoutActivityDto[];
    message: string;
  }> {
    const { data } = await apiClient.post(
      '/workouts/integrations/garmin/calendar-api',
      payload,
    );
    return data;
  },

  async disconnectProvider(provider: FitnessProvider): Promise<{ success: boolean }> {
    const { data } = await apiClient.delete<{ success: boolean }>(
      `/workouts/integrations/${provider}`,
    );
    return data;
  },

  async completeWorkout(id: string): Promise<WorkoutActivityDto> {
    const { data } = await apiClient.post<WorkoutActivityDto>(`/workouts/${id}/complete`);
    return data;
  },

  async cheerWorkout(id: string, message?: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      `/workouts/${id}/cheer`,
      { message },
    );
    return data;
  },

  async deleteWorkout(id: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.delete<{ success: boolean }>(`/workouts/${id}`);
    return data;
  },
};

