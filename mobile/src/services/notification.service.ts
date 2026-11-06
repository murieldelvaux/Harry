import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './api';
import {
  NotificationDto,
  NotificationPreferenceDto,
} from '@harry/shared';

const DAILY_BRIEFING_ID = 'harry_daily_briefing';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export interface NotificationsListResponse {
  unreadCount: number;
  items: NotificationDto[];
}

export const notificationService = {
  /**
   * Lista notificações In-App e contagem de não lidas do usuário
   */
  async listNotifications(): Promise<NotificationsListResponse> {
    const response = await apiClient.get<NotificationsListResponse>('/notifications');
    return response.data;
  },

  /**
   * Marca uma notificação individual como lida
   */
  async markAsRead(id: string): Promise<{ success: boolean }> {
    const response = await apiClient.patch<{ success: boolean }>(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Marca todas as notificações do usuário como lidas
   */
  async markAllAsRead(): Promise<{ success: boolean }> {
    const response = await apiClient.patch<{ success: boolean }>('/notifications/read-all');
    return response.data;
  },

  /**
   * Registra o Expo Push Token no backend
   */
  async savePushTokenToBackend(expoPushToken: string): Promise<{ success: boolean; expoPushToken: string }> {
    const response = await apiClient.post<{ success: boolean; expoPushToken: string }>(
      '/notifications/push-token',
      { expoPushToken },
    );
    return response.data;
  },

  /**
   * Busca preferências multi-canal por categoria (Finanças, Agenda, Compras, Treinos)
   */
  async getPreferences(): Promise<NotificationPreferenceDto[]> {
    const response = await apiClient.get<NotificationPreferenceDto[]>('/notifications/preferences');
    return response.data;
  },

  /**
   * Atualiza preferências multi-canal por categoria
   */
  async updatePreferences(
    preferences: NotificationPreferenceDto[],
  ): Promise<NotificationPreferenceDto[]> {
    const response = await apiClient.put<NotificationPreferenceDto[]>(
      '/notifications/preferences',
      { preferences },
    );
    return response.data;
  },

  /**
   * Solicita permissão e registra o token Expo Push automaticamente
   */
  async registerDevicePushToken(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const tokenResult = await Notifications.getExpoPushTokenAsync();
      const token = tokenResult?.data;
      if (token) {
        await this.savePushTokenToBackend(token);
        return token;
      }
      return null;
    } catch (e) {
      console.warn('Não foi possível obter ExpoPushToken neste ambiente:', e);
      return null;
    }
  },

  /**
   * Solicita permissão para envio de notificações locais/push
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Notificações Harry',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
          sound: 'default',
        });
      }

      return true;
    } catch (e) {
      console.warn('Erro ao solicitar permissões de notificação:', e);
      return false;
    }
  },

  /**
   * Agenda a notificação diária matinal para o horário especificado (ex: "06:00")
   */
  async scheduleDailyBriefing(timeStr: string = '06:00'): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;

      await this.cancelDailyBriefing();

      const [hourStr, minStr] = timeStr.split(':');
      const hour = parseInt(hourStr || '6', 10);
      const minute = parseInt(minStr || '0', 10);

      await Notifications.scheduleNotificationAsync({
        identifier: DAILY_BRIEFING_ID,
        content: {
          title: '🌅 Bom dia! Seu Resumo Harry',
          body: 'Seus compromissos de hoje, tarefas e lista de compras já estão prontos com o Harry.',
          data: { url: '/(tabs)/calendar' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      return true;
    } catch (e) {
      console.warn('Erro ao agendar notificação diária:', e);
      return false;
    }
  },

  /**
   * Cancela a notificação diária agendada
   */
  async cancelDailyBriefing(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelScheduledNotificationAsync(DAILY_BRIEFING_ID);
    } catch (e) {
      console.warn('Erro ao cancelar notificação agendada:', e);
    }
  },

  /**
   * Dispara uma notificação de teste imediata no celular
   */
  async triggerTestNotification(customBody?: string): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Resumo Harry (Teste)',
          body:
            customBody ||
            'Tudo certo! Suas notificações matinais de agenda, tarefas e compras do Harry estão ativas.',
          data: { url: '/(tabs)/calendar' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          repeats: false,
        },
      });

      return true;
    } catch (e) {
      console.warn('Erro ao disparar notificação de teste:', e);
      return false;
    }
  },
};
