import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DAILY_BRIEFING_ID = 'harry_daily_briefing';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export const notificationService = {
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
          name: 'Resumo Diário Harry',
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

      // Cancelar anterior para evitar duplicidade
      await this.cancelDailyBriefing();

      const [hourStr, minStr] = timeStr.split(':');
      const hour = parseInt(hourStr || '6', 10);
      const minute = parseInt(minStr || '0', 10);

      await Notifications.scheduleNotificationAsync({
        identifier: DAILY_BRIEFING_ID,
        content: {
          title: '🌅 Bom dia! Seu Resumo Harry',
          body: 'Seus compromissos de hoje, tarefas e lista de compras já estão prontos com o Harry.',
          data: { url: '/calendar' },
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
          data: { url: '/calendar' },
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
