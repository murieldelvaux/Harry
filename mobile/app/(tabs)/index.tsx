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
import { TransactionType } from '../../../packages/shared/src';
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

  const [dashboardBalanceMode, setDashboardBalanceMode] = useState<'INDIVIDUAL' | 'JOINT'>('INDIVIDUAL');

  // Balanço Individual (Visão Pessoal do Usuário)
  const myIncome = summary?.myIncome ?? (summary?.totalIncome ?? 0);
  const myPrivateExpenses = summary?.myPrivateExpenses ?? (summary?.totalPrivate ?? 0);
  const myShareOfShared = summary?.myShareOfSharedExpenses ?? (summary?.userShareOfShared ?? 0);
  const myTotalExpenses = summary?.myTotalExpenses ?? (myPrivateExpenses + myShareOfShared);
  const myBalance = summary?.myBalance ?? (myIncome - myTotalExpenses);
  const isMyPositiveBalance = myBalance >= 0;

  // Balanço em Conjunto (Visão Casal / Casa)
  const jointIncome = summary?.jointIncome ?? (summary?.totalIncome ?? 0);
  const jointExpenses = summary?.jointExpenses ?? (summary?.totalShared ?? 0);
  const jointBalance = summary?.jointBalance ?? (jointIncome - jointExpenses);
  const isJointPositiveBalance = jointBalance >= 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER PRINCIPAL COM MENU LATERAL HAMBÚRGUER & LOGO */}
      <AppHeader
        title="Harry"
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

        {/* HERO CARD FINANCEIRO (BALANÇO INDIVIDUAL vs EM CONJUNTO) */}
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
          {/* SELETOR DE MODO DE BALANÇO */}
          <View
            style={[
              styles.balanceModeToggle,
              { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.balanceModeBtn,
                dashboardBalanceMode === 'INDIVIDUAL' && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                  elevation: 2,
                },
              ]}
              onPress={() => setDashboardBalanceMode('INDIVIDUAL')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.balanceModeText,
                  {
                    color: dashboardBalanceMode === 'INDIVIDUAL' ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: dashboardBalanceMode === 'INDIVIDUAL' ? '700' : '600',
                  },
                ]}
              >
                👤 Meu Balanço (Individual)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.balanceModeBtn,
                dashboardBalanceMode === 'JOINT' && {
                  backgroundColor: '#8B5CF6',
                  borderColor: '#8B5CF6',
                  elevation: 2,
                },
              ]}
              onPress={() => setDashboardBalanceMode('JOINT')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.balanceModeText,
                  {
                    color: dashboardBalanceMode === 'JOINT' ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: dashboardBalanceMode === 'JOINT' ? '700' : '600',
                  },
                ]}
              >
                👥 Em Conjunto (Casal)
              </Text>
            </TouchableOpacity>
          </View>

          {dashboardBalanceMode === 'INDIVIDUAL' ? (
            <>
              {/* TOPO: MEU SALDO INDIVIDUAL */}
              <View style={styles.heroTop}>
                <View>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
                    Meu Saldo Individual
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                    Suas entradas menos suas despesas reais
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isMyPositiveBalance
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isMyPositiveBalance ? '#059669' : '#DC2626', fontWeight: '700' },
                    ]}
                  >
                    {isMyPositiveBalance ? '🟢 Saldo Positivo' : '🔴 Em Déficit'}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.heroValue,
                  { color: isMyPositiveBalance ? (isDark ? '#34D399' : '#059669') : '#DC2626' },
                ]}
              >
                {isMyPositiveBalance ? `+ ${formatCurrency(myBalance)}` : `- ${formatCurrency(Math.abs(myBalance))}`}
              </Text>

              {/* TOTAL ENTRADAS E SAÍDAS INDIVIDUAIS */}
              <View
                style={[
                  styles.inOutHeroRow,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                ]}
              >
                <View style={styles.inOutHeroItem}>
                  <Text style={[styles.inOutHeroLabel, { color: theme.textSecondary }]}>
                    ↗️ Meus Ganhos
                  </Text>
                  <Text style={[styles.inOutHeroValue, { color: '#059669' }]}>
                    + {formatCurrency(myIncome)}
                  </Text>
                </View>
                <View style={[styles.inOutHeroDivider, { backgroundColor: theme.border }]} />
                <View style={styles.inOutHeroItem}>
                  <Text style={[styles.inOutHeroLabel, { color: theme.textSecondary }]}>
                    ↘️ Meus Gastos Reais
                  </Text>
                  <Text style={[styles.inOutHeroValue, { color: '#DC2626' }]}>
                    - {formatCurrency(myTotalExpenses)}
                  </Text>
                </View>
              </View>

              {/* COMPOSIÇÃO DOS GASTOS DO USUÁRIO */}
              <View style={[styles.splitMetricsRow, { borderTopColor: theme.border }]}>
                <View style={styles.splitMetricItem}>
                  <View style={styles.splitIconLabel}>
                    <Text style={{ fontSize: 13 }}>🔒</Text>
                    <Text style={[styles.splitLabel, { color: theme.textSecondary }]}>Seus Gastos Privados</Text>
                  </View>
                  <Text style={[styles.splitValue, { color: theme.textPrimary }]}>
                    {formatCurrency(myPrivateExpenses)}
                  </Text>
                  <Text style={[styles.splitSub, { color: theme.textMuted }]}>
                    100% individual seu
                  </Text>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

                <View style={styles.splitMetricItem}>
                  <View style={styles.splitIconLabel}>
                    <Text style={{ fontSize: 13 }}>🏠</Text>
                    <Text style={[styles.splitLabel, { color: theme.textSecondary }]}>Sua Cota da Casa (50%)</Text>
                  </View>
                  <Text style={[styles.splitValue, { color: theme.primary }]}>
                    {formatCurrency(myShareOfShared)}
                  </Text>
                  <Text style={[styles.splitSub, { color: theme.textMuted }]}>
                    Metade dos compartilhados
                  </Text>
                </View>
              </View>

              <View style={[styles.individualNoticeBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Text style={[styles.individualNoticeText, { color: theme.textMuted }]}>
                  🛡️ <Text style={{ fontWeight: '600' }}>Finanças Justas:</Text> Os gastos individuais do seu parceiro NÃO são descontados do seu balanço.
                </Text>
              </View>
            </>
          ) : (
            <>
              {/* TOPO: BALANÇO EM CONJUNTO */}
              <View style={styles.heroTop}>
                <View>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
                    Balanço em Conjunto (Casal)
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                    Contas e despesas da residência
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isJointPositiveBalance
                        ? 'rgba(139, 92, 246, 0.15)'
                        : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isJointPositiveBalance ? '#8B5CF6' : '#DC2626', fontWeight: '700' },
                    ]}
                  >
                    {isJointPositiveBalance ? '👥 Superávit Casa' : '🔴 Déficit Casa'}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.heroValue,
                  { color: isJointPositiveBalance ? (isDark ? '#34D399' : '#059669') : '#DC2626' },
                ]}
              >
                {isJointPositiveBalance ? `+ ${formatCurrency(jointBalance)}` : `- ${formatCurrency(Math.abs(jointBalance))}`}
              </Text>

              {/* TOTAL ENTRADAS E SAÍDAS CONJUNTAS */}
              <View
                style={[
                  styles.inOutHeroRow,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                ]}
              >
                <View style={styles.inOutHeroItem}>
                  <Text style={[styles.inOutHeroLabel, { color: theme.textSecondary }]}>
                    ↗️ Renda Conjunta
                  </Text>
                  <Text style={[styles.inOutHeroValue, { color: '#059669' }]}>
                    + {formatCurrency(jointIncome)}
                  </Text>
                </View>
                <View style={[styles.inOutHeroDivider, { backgroundColor: theme.border }]} />
                <View style={styles.inOutHeroItem}>
                  <Text style={[styles.inOutHeroLabel, { color: theme.textSecondary }]}>
                    ↘️ Despesas da Casa
                  </Text>
                  <Text style={[styles.inOutHeroValue, { color: '#DC2626' }]}>
                    - {formatCurrency(jointExpenses)}
                  </Text>
                </View>
              </View>

              {/* DIVISÃO DAS CONTAS DA CASA */}
              <View style={[styles.splitMetricsRow, { borderTopColor: theme.border }]}>
                <View style={styles.splitMetricItem}>
                  <View style={styles.splitIconLabel}>
                    <Text style={{ fontSize: 13 }}>🏠</Text>
                    <Text style={[styles.splitLabel, { color: theme.textSecondary }]}>Total da Casa</Text>
                  </View>
                  <Text style={[styles.splitValue, { color: theme.primary }]}>
                    {formatCurrency(summary?.totalShared || 0)}
                  </Text>
                  <Text style={[styles.splitSub, { color: theme.textMuted }]}>
                    Contas compartilhadas
                  </Text>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

                <View style={styles.splitMetricItem}>
                  <View style={styles.splitIconLabel}>
                    <Text style={{ fontSize: 13 }}>⚖️</Text>
                    <Text style={[styles.splitLabel, { color: theme.textSecondary }]}>Divisão 50/50</Text>
                  </View>
                  <Text style={[styles.splitValue, { color: theme.textPrimary }]}>
                    {formatCurrency(summary?.userShareOfShared || 0)} cada
                  </Text>
                  <Text style={[styles.splitSub, { color: theme.textMuted }]}>
                    Sua parte e do par
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
                        Individual dele
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            </>
          )}
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
              <Text style={[styles.actionPillText, { color: theme.textPrimary }]}>+ Finanças</Text>
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
            expenses.slice(0, 5).map((item) => {
              const isIncome = item.type === TransactionType.INCOME;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.expenseRowItem,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    theme.cardShadow,
                  ]}
                >
                  <View
                    style={[
                      styles.categoryIconBadge,
                      {
                        backgroundColor: isIncome
                          ? 'rgba(16, 185, 129, 0.12)'
                          : theme.surfaceSubtle,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{isIncome ? '💰' : '🧾'}</Text>
                  </View>

                  <View style={styles.expenseInfoCol}>
                    <Text style={[styles.expenseTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <View style={styles.expenseSubRow}>
                      <Text
                        style={[
                          styles.expenseCategoryText,
                          {
                            color: isIncome ? '#059669' : theme.textSecondary,
                            fontWeight: isIncome ? '700' : '400',
                          },
                        ]}
                      >
                        {isIncome ? `🟢 ${getCategoryLabel(item.category)}` : getCategoryLabel(item.category)}
                      </Text>
                      <Text style={[styles.expenseDot, { color: theme.textMuted }]}>•</Text>
                      <Text style={[styles.expenseDateText, { color: theme.textMuted }]}>
                        {formatDate(item.date)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.expenseAmountCol}>
                    <Text
                      style={[
                        styles.expenseAmountText,
                        {
                          color: isIncome
                            ? (isDark ? '#34D399' : '#059669')
                            : theme.textPrimary,
                        },
                      ]}
                    >
                      {isIncome ? `+ ${formatCurrency(item.amount)}` : `- ${formatCurrency(item.amount)}`}
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
              );
            })
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.emptyEmoji}>🍃</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nenhum lançamento registrado neste mês ainda.
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
  inOutHeroRow: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  inOutHeroItem: {
    flex: 1,
  },
  inOutHeroLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  inOutHeroValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  inOutHeroDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    marginHorizontal: 10,
  },
  balanceModeToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    gap: 4,
  },
  balanceModeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  balanceModeText: {
    fontSize: 12,
  },
  individualNoticeBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  individualNoticeText: {
    fontSize: 11,
    lineHeight: 15,
  },
});
