import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useExpenses } from '../../src/hooks/useExpenses';
import { useAuth } from '../../src/hooks/useAuth';
import { useHousehold } from '../../src/hooks/useHousehold';
import { formatCurrency, formatDate, getCategoryLabel } from '../../src/utils/format';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { household } = useHousehold();
  const { theme, isDark } = useTheme();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [activeScope, setActiveScope] = useState<'ALL' | 'SHARED' | 'PRIVATE'>('ALL');

  const { expenses, summary, isLoading, isError, refetch, isRefetching } = useExpenses({
    month: currentMonth,
    scope: activeScope,
  });

  const totalGeral =
    (summary?.totalShared || 0) +
    (summary?.totalPrivate || 0) +
    (summary?.partnerPrivate || 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER PRINCIPAL COM MENU LATERAL HAMBÚRGUER & LOGO */}
      <AppHeader
        title="Nexo"
        subtitle={household?.name ? `🏠 ${household.name}` : 'Visão Geral do Lar'}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* BOAS-VINDAS & SAUDAÇÃO */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeGreeting, { color: theme.textSecondary }]}>
            Bem-vindo(a) de volta,
          </Text>
          <Text style={[styles.userNameTitle, { color: theme.textPrimary }]}>
            {user?.name || 'Gestão do Lar'} 👋
          </Text>
        </View>

        {/* HERO CARD FINANCEIRO (BALANÇO GERAL) */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#151D2A' : '#FFFFFF',
              borderColor: theme.border,
            },
            theme.cardShadow,
          ]}
        >
          <View style={styles.heroTop}>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
              Total de Gastos no Mês
            </Text>
            <View style={[styles.statusPill, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.statusPillText, { color: theme.primary }]}>
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>

          <Text style={[styles.heroValue, { color: theme.textPrimary }]}>
            {formatCurrency(totalGeral)}
          </Text>

          {/* DIVISÃO COMPARTILHADA VS PRIVADA */}
          <View style={[styles.splitMetricsRow, { borderTopColor: theme.border }]}>
            <View style={styles.splitMetricItem}>
              <View style={styles.splitIconLabel}>
                <Text style={{ fontSize: 13 }}>🏠</Text>
                <Text style={[styles.splitLabel, { color: theme.textSecondary }]}>Gastos Compartilhados</Text>
              </View>
              <Text style={[styles.splitValue, { color: theme.primary }]}>
                {formatCurrency(summary?.totalShared || 0)}
              </Text>
              <Text style={[styles.splitSub, { color: theme.textMuted }]}>
                Sua parte: {formatCurrency(summary?.userShareOfShared || 0)}
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

            <View style={styles.splitMetricItem}>
              <View style={styles.splitIconLabel}>
                <Text style={{ fontSize: 13 }}>🔒</Text>
                <Text style={[styles.splitLabel, { color: theme.textSecondary }]}>Seus Gastos</Text>
              </View>
              <Text style={[styles.splitValue, { color: theme.textPrimary }]}>
                {formatCurrency(summary?.totalPrivate || 0)}
              </Text>
              <Text style={[styles.splitSub, { color: theme.textMuted }]}>
                Individual
              </Text>
            </View>

            {!!summary?.partnerPrivate && summary.partnerPrivate > 0 ? (
              <>
                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />
                <View style={styles.splitMetricItem}>
                  <View style={styles.splitIconLabel}>
                    <Text style={{ fontSize: 13 }}>👁️</Text>
                    <Text style={[styles.splitLabel, { color: theme.textSecondary }]}>Privado do Par</Text>
                  </View>
                  <Text style={[styles.splitValue, { color: '#8B5CF6' }]}>
                    {formatCurrency(summary.partnerPrivate)}
                  </Text>
                  <Text style={[styles.splitSub, { color: theme.textMuted }]}>
                    Compartilhado
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* ATALHOS RÁPIDOS NA ZONA DO POLEGAR */}
        <View style={styles.actionPillsSection}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Ações Rápidas
          </Text>
          <View style={styles.actionPillsRow}>
            <TouchableOpacity
              style={[styles.actionPillBtn, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}
              onPress={() => router.push('/(tabs)/expenses')}
              activeOpacity={0.75}
            >
              <Text style={styles.actionPillEmoji}>💸</Text>
              <Text style={[styles.actionPillText, { color: theme.textPrimary }]}>+ Gasto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionPillBtn, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}
              onPress={() => router.push('/(tabs)/goals')}
              activeOpacity={0.75}
            >
              <Text style={styles.actionPillEmoji}>🎯</Text>
              <Text style={[styles.actionPillText, { color: theme.textPrimary }]}>+ Meta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionPillBtn, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}
              onPress={() => router.push('/(tabs)/tasks')}
              activeOpacity={0.75}
            >
              <Text style={styles.actionPillEmoji}>📌</Text>
              <Text style={[styles.actionPillText, { color: theme.textPrimary }]}>+ Lembrete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FEED DE ATIVIDADES RECENTES */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Últimos Lançamentos
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/expenses')}>
              <Text style={[styles.viewAllText, { color: theme.primary }]}>Ver Todos ➔</Text>
            </TouchableOpacity>
          </View>

          {/* Filtro Rápido de Escopo */}
          <View style={styles.scopeFilterRow}>
            {(['ALL', 'SHARED', 'PRIVATE'] as const).map((s) => {
              const isActive = activeScope === s;
              const labels = { ALL: 'Todos', SHARED: '🏠 Compartilhados', PRIVATE: '🔒 Pessoais' };
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.scopeChip,
                    {
                      backgroundColor: isActive ? theme.primary : theme.surface,
                      borderColor: isActive ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setActiveScope(s)}
                >
                  <Text
                    style={[
                      styles.scopeChipText,
                      { color: isActive ? '#FFFFFF' : theme.textSecondary, fontWeight: isActive ? '700' : '500' },
                    ]}
                  >
                    {labels[s]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Lista de Gastos Recentes */}
          {expenses && expenses.length > 0 ? (
            expenses.slice(0, 5).map((item) => (
              <View
                key={item.id}
                style={[
                  styles.expenseRowItem,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  theme.cardShadow,
                ]}
              >
                <View style={[styles.categoryIconBadge, { backgroundColor: theme.surfaceSubtle }]}>
                  <Text style={{ fontSize: 18 }}>🧾</Text>
                </View>

                <View style={styles.expenseInfoCol}>
                  <Text style={[styles.expenseTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <View style={styles.expenseSubRow}>
                    <Text style={[styles.expenseCategoryText, { color: theme.textSecondary }]}>
                      {getCategoryLabel(item.category)}
                    </Text>
                    <Text style={[styles.expenseDot, { color: theme.textMuted }]}>•</Text>
                    <Text style={[styles.expenseDateText, { color: theme.textMuted }]}>
                      {formatDate(item.date)}
                    </Text>
                  </View>
                </View>

                <View style={styles.expenseAmountCol}>
                  <Text style={[styles.expenseAmountText, { color: theme.textPrimary }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                  <View
                    style={[
                      styles.miniScopeTag,
                      {
                        backgroundColor:
                          item.scope === 'SHARED'
                            ? theme.tagSharedBg
                            : item.scope === 'PRIVATE' && !!user?.id && item.userId !== user.id
                            ? 'rgba(139, 92, 246, 0.15)'
                            : theme.tagPrivateBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.miniScopeTagText,
                        {
                          color:
                            item.scope === 'SHARED'
                              ? theme.tagSharedText
                              : item.scope === 'PRIVATE' && !!user?.id && item.userId !== user.id
                              ? '#8B5CF6'
                              : theme.tagPrivateText,
                        },
                      ]}
                    >
                      {item.scope === 'SHARED'
                        ? 'Casa'
                        : item.scope === 'PRIVATE' && !!user?.id && item.userId !== user.id
                        ? `👁️ ${item.author?.name || 'Par'}`
                        : 'Pessoal'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.emptyEmoji}>🍃</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nenhum gasto registrado neste mês ainda.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  welcomeSection: {
    marginTop: 4,
  },
  welcomeGreeting: {
    fontSize: 13,
    fontWeight: '500',
  },
  userNameTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  splitMetricsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    alignItems: 'center',
  },
  splitMetricItem: {
    flex: 1,
  },
  splitIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  splitLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  splitValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  splitSub: {
    fontSize: 10,
    marginTop: 2,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    marginHorizontal: 12,
  },
  actionPillsSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  actionPillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  actionPillEmoji: {
    fontSize: 18,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activitySection: {
    gap: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scopeFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  scopeChipText: {
    fontSize: 12,
  },
  expenseRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  categoryIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseInfoCol: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  expenseSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  expenseCategoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  expenseDot: {
    fontSize: 11,
  },
  expenseDateText: {
    fontSize: 11,
  },
  expenseAmountCol: {
    alignItems: 'flex-end',
  },
  expenseAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  miniScopeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  miniScopeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 28,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 28,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
