import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useDrawer } from '../context/DrawerContext';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';

const HarryLogo = require('../../assets/harry-logo.png');

interface NavItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'settings',
    title: 'Perfil e Configurações',
    subtitle: 'Foto, WhatsApp e lar',
    route: '/(tabs)/settings',
    icon: '👤',
  },
  {
    id: 'dashboard',
    title: 'Início & Resumo',
    subtitle: 'Visão consolidada',
    route: '/(tabs)',
    icon: '📊',
  },
  {
    id: 'expenses',
    title: 'Gastos & Finanças',
    subtitle: 'Despesas divididas e pessoais',
    route: '/(tabs)/expenses',
    icon: '💸',
  },
  {
    id: 'goals',
    title: 'Metas Financeiras',
    subtitle: 'Objetivos e poupança do casal',
    route: '/(tabs)/goals',
    icon: '🎯',
  },
  {
    id: 'tasks',
    title: 'Rotina & Lembretes',
    subtitle: 'Contas a pagar e compromissos',
    route: '/(tabs)/tasks',
    icon: '📌',
  },
  {
    id: 'shopping',
    title: 'Lista de Compras',
    subtitle: 'Mercado, feira e casa',
    route: '/(tabs)/shopping-list',
    icon: '🛒',
  },
  {
    id: 'calendar',
    title: 'Agenda & Calendário',
    subtitle: 'Eventos e Google Agenda',
    route: '/(tabs)/calendar',
    icon: '📅',
  },
];

export function AppDrawer() {
  const { isOpen, closeDrawer } = useDrawer();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { household } = useHousehold();
  const router = useRouter();
  const pathname = usePathname();

  if (!isOpen) return null;

  const handleNavigate = (route: string) => {
    closeDrawer();
    router.push(route as any);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja realmente sair da sua conta?')) {
        closeDrawer();
        logout();
      }
      return;
    }

    Alert.alert('Sair da Conta', 'Deseja realmente encerrar a sessão no Harry?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          closeDrawer();
          logout();
        },
      },
    ]);
  };

  const userInitials = user?.name
    ? user.name
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'HY';

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDrawer}
    >
      <View style={styles.overlay}>
        {/* Backdrop escurecido clicável para fechar */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeDrawer}
        />

        {/* Painel Lateral (Drawer) */}
        <SafeAreaView
          style={[
            styles.drawerContent,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            theme.cardShadow,
          ]}
        >
          {/* HEADER DO MENU: LOGO & FECHAR */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.brandRow}>
              <Image source={HarryLogo} style={styles.logo} resizeMode="contain" />
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>Harry</Text>
                <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  Gestão Inteligente individual e compartilhada
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={closeDrawer}
              style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* PERFIL DO USUÁRIO & ESPAÇO */}
          <View style={[styles.userSection, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                {user?.name || 'Usuário Harry'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                {user?.email || ''}
              </Text>
              <View style={[styles.householdTag, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.householdTagText, { color: theme.primary }]}>
                  {household?.name ? `🏠 ${household.name}` : '👤 Individual'}
                </Text>
              </View>
            </View>
          </View>

          {/* ITENS DE NAVEGAÇÃO PRINCIPAIS */}
          <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>
              NAVEGAÇÃO PRINCIPAL
            </Text>

            {NAV_ITEMS.map((item) => {
              const cleanRoute = item.route.replace('/(tabs)', '');
              const cleanPath = pathname.replace('/(tabs)', '');

              const isHome = item.id === 'dashboard' && (cleanPath === '' || cleanPath === '/' || cleanPath === '/index');
              const isMatch = cleanRoute !== '' && (cleanPath === cleanRoute || cleanPath.startsWith(cleanRoute) || pathname.includes(item.id));
              const isActive = isHome || isMatch;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    isActive && {
                      backgroundColor: theme.primaryLight,
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => handleNavigate(item.route)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.itemIconContainer,
                      {
                        backgroundColor: isActive
                          ? theme.primary
                          : theme.surfaceSubtle,
                      },
                    ]}
                  >
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                  </View>

                  <View style={styles.itemTexts}>
                    <Text
                      style={[
                        styles.itemTitle,
                        {
                          color: isActive ? theme.primary : theme.textPrimary,
                          fontWeight: isActive ? '700' : '600',
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.itemSubtitle,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>

                  {isActive && (
                    <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* CARD DO ASSISTENTE WHATSAPP */}
            <View
              style={[
                styles.assistantCard,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
                },
              ]}
            >
              <View style={styles.assistantHeader}>
                <Text style={styles.assistantIcon}>💬</Text>
                <Text style={[styles.assistantTitle, { color: isDark ? '#34D399' : '#065F46' }]}>
                  Assistente Harry no WhatsApp
                </Text>
              </View>
              <Text style={[styles.assistantDesc, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                Comece sua mensagem com "Harry" para registrar gastos, agenda e compras instantaneamente!
              </Text>
            </View>
          </ScrollView>

          {/* RODAPÉ DO MENU: TEMA & LOGOUT */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            {/* Toggle de Tema Light / Dark */}
            <TouchableOpacity
              style={[
                styles.themeBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              <View style={styles.themeBtnLeft}>
                <Text style={styles.themeBtnIcon}>{isDark ? '🌙' : '☀️'}</Text>
                <Text style={[styles.themeBtnText, { color: theme.textPrimary }]}>
                  {isDark ? 'Tema Escuro' : 'Tema Claro'}
                </Text>
              </View>
              <View style={[styles.themePill, { backgroundColor: theme.primary }]}>
                <Text style={styles.themePillText}>{isDark ? 'Dark' : 'Light'}</Text>
              </View>
            </TouchableOpacity>

            {/* Botão Sair */}
            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: theme.dangerLight }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={[styles.logoutText, { color: theme.danger }]}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerContent: {
    width: 320,
    maxWidth: '85%',
    height: '100%',
    borderRightWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
    ...Platform.select({
      web: {
        boxShadow: '10px 0 25px -5px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 9,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  householdTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  householdTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  menuList: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginBottom: 8,
    marginTop: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
    gap: 12,
  },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIcon: {
    fontSize: 18,
  },
  itemTexts: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  activeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  assistantCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 20,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  assistantIcon: {
    fontSize: 14,
  },
  assistantTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  assistantDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  themeBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  themeBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeBtnIcon: {
    fontSize: 16,
  },
  themeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  themePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    gap: 8,
  },
  logoutIcon: {
    fontSize: 14,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
