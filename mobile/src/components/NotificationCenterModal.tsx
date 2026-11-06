import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationDto } from '@harry/shared';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationCenterModal({
  visible,
  onClose,
}: NotificationCenterModalProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  } = useNotifications(visible || true);

  if (!visible) return null;

  const handlePressNotification = async (item: NotificationDto) => {
    if (!item.readAt) {
      try {
        await markAsRead(item.id);
      } catch {
        // segue
      }
    }
    onClose();
    if (item.deepLink) {
      router.push(item.deepLink as any);
    }
  };

  const formatTimeAgo = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMin < 1) return 'Agora mesmo';
      if (diffMin < 60) return `Há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Há ${diffHours}h`;
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay} testID="notification-center-modal">
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            theme.cardShadow,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                🔔 Central de Notificações
              </Text>
              {unreadCount > 0 && (
                <View style={[styles.unreadPill, { backgroundColor: theme.primary }]}>
                  <Text style={styles.unreadPillText}>{unreadCount} nova(s)</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  testID="mark-all-notifications-read"
                  accessibilityLabel="Marcar todas como lidas"
                  onPress={() => markAllAsRead()}
                  disabled={isMarkingAllRead}
                  style={[styles.readAllBtn, { backgroundColor: theme.primaryLight }]}
                >
                  <Text style={[styles.readAllText, { color: theme.primary }]}>
                    ✓ Ler todas
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                testID="close-notification-center"
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle }]}
              >
                <Text style={[styles.closeText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>✨</Text>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  Tudo em dia por aqui!
                </Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  Quando seu parceiro(a) lançar despesas compartilhadas, fechar contas, criar lembretes ou concluir um treino, você será avisado aqui.
                </Text>
              </View>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <TouchableOpacity
                    key={notif.id}
                    testID={`notification-item-${notif.id}`}
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: isUnread
                          ? theme.primaryLight
                          : theme.surfaceSubtle,
                        borderColor: isUnread ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => handlePressNotification(notif)}
                    activeOpacity={0.78}
                  >
                    <View style={styles.itemHeader}>
                      <Text
                        style={[
                          styles.itemTitle,
                          {
                            color: theme.textPrimary,
                            fontWeight: isUnread ? '800' : '600',
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {notif.title}
                      </Text>
                      {isUnread && (
                        <View
                          style={[styles.unreadDot, { backgroundColor: theme.primary }]}
                        />
                      )}
                    </View>

                    <Text
                      style={[styles.itemBody, { color: theme.textSecondary }]}
                      numberOfLines={3}
                    >
                      {notif.body}
                    </Text>

                    <View style={styles.itemFooter}>
                      <View style={styles.channelsRow}>
                        {(notif.channels || ['IN_APP']).map((ch) => (
                          <View
                            key={ch}
                            style={[
                              styles.channelChip,
                              { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                          >
                            <Text style={[styles.channelText, { color: theme.textMuted }]}>
                              {ch === 'IN_APP'
                                ? '📱 App'
                                : ch === 'PUSH'
                                ? '🔔 Push'
                                : '💬 WhatsApp'}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.footerRight}>
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>
                          {formatTimeAgo(notif.createdAt)}
                        </Text>
                        {isUnread && (
                          <TouchableOpacity
                            testID={`mark-notification-read-${notif.id}`}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              markAsRead(notif.id);
                            }}
                            style={[styles.markOneBtn, { borderColor: theme.primary }]}
                          >
                            <Text style={[styles.markOneText, { color: theme.primary }]}>
                              Marcar lida
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 14,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  unreadPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  readAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    padding: 14,
  },
  emptyBox: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  itemCard: {
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    flex: 1,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 4,
  },
  itemBody: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  channelChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  channelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  markOneBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  markOneText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});

