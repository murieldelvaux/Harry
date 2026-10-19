import { apiClient } from './api';
import {
  CalendarEventDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  GoogleCalendarItemDto,
} from '../../../packages/shared/src';

export interface GoogleSyncResult {
  success: boolean;
  needsConnect?: boolean;
  needsActivation?: boolean;
  activationUrl?: string;
  message: string;
  importedFromGoogle?: number;
  exportedToGoogle?: number;
  calendarsCount?: number;
  error?: string;
}

export const calendarService = {
  async getAll(start?: string, end?: string): Promise<CalendarEventDto[]> {
    const { data } = await apiClient.get<CalendarEventDto[]>('/calendar', {
      params: { start, end },
    });
    return data;
  },

  async getById(id: string): Promise<CalendarEventDto> {
    const { data } = await apiClient.get<CalendarEventDto>(`/calendar/${id}`);
    return data;
  },

  async create(dto: CreateCalendarEventDto): Promise<CalendarEventDto> {
    const { data } = await apiClient.post<CalendarEventDto>('/calendar', dto);
    return data;
  },

  async update(id: string, dto: UpdateCalendarEventDto): Promise<CalendarEventDto> {
    const { data } = await apiClient.put<CalendarEventDto>(`/calendar/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.delete<{ success: boolean }>(`/calendar/${id}`);
    return data;
  },

  async syncGoogle(): Promise<GoogleSyncResult> {
    const { data } = await apiClient.post<GoogleSyncResult>('/calendar/sync-google');
    return data;
  },

  async listCalendars(): Promise<GoogleCalendarItemDto[]> {
    const { data } = await apiClient.get<GoogleCalendarItemDto[]>('/calendar/list-calendars');
    return data;
  },

  async setupWatch(callbackBaseUrl?: string): Promise<{ success: boolean; message: string; channels: any[] }> {
    const { data } = await apiClient.post('/calendar/watch', { callbackBaseUrl });
    return data;
  },

  async getContext7Anchor(): Promise<{ anchor: string }> {
    const { data } = await apiClient.get<{ anchor: string }>('/calendar/context7-anchor');
    return data;
  },

  async triggerDailyBriefing(): Promise<{
    success: boolean;
    message: string;
    summary: string;
    whatsappSent: boolean;
    whatsappStatus: string;
    phoneNumber?: string;
    stats: {
      eventsCount: number;
      tasksCount: number;
      shoppingCount: number;
    };
  }> {
    const { data } = await apiClient.post('/calendar/daily-briefing/trigger');
    return data;
  },
};
