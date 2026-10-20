import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useDrawer } from '../context/DrawerContext';
import { useTheme } from '../theme/ThemeContext';

const HarryLogo = require('../../assets/harry-logo.png');

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export function AppHeader({ title, subtitle, rightAction }: AppHeaderProps) {
  const { openDrawer } = useDrawer();
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <View style={[styles.headerContainer, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
      {/* Botão Hambúrguer para abrir Menu Lateral + Logo */}
      <View style={styles.leftGroup}>
        <TouchableOpacity
          onPress={openDrawer}
          style={[styles.menuBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.menuIcon, { color: theme.textPrimary }]}>☰</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openDrawer} style={styles.brandRow} activeOpacity={0.8}>
          <Image source={HarryLogo} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>
              {title || 'Harry'}
            </Text>
            {subtitle ? (
              <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      {/* Ações da Direita: Toggle de Tema ou Ação Personalizada */}
      <View style={styles.rightGroup}>
        {rightAction ? (
          rightAction
        ) : (
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.themeToggleBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Text style={styles.themeToggleIcon}>{isDark ? '🌙' : '☀️'}</Text>
            <Text style={[styles.themeToggleText, { color: theme.textPrimary }]}>
              {isDark ? 'Dark' : 'Light'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: -1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
  },
  themeToggleIcon: {
    fontSize: 12,
  },
  themeToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
