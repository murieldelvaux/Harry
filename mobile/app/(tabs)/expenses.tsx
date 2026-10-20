import React, { useState, useMemo } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { ScopeBadge } from '../../src/components/ScopeBadge';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { CalendarRangePickerModal } from '../../src/components/CalendarRangePickerModal';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import { useExpenses } from '../../src/hooks/useExpenses';
import { useAuth } from '../../src/hooks/useAuth';
import { formatCurrency, formatDate, getCategoryLabel, maskCurrency, unmaskCurrency, maskDate } from '../../src/utils/format';
import { ExpenseCategory, RecordScope, TransactionType, ExpenseDto } from '../../../packages/shared/src';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const INCOME_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.SALARY,
  ExpenseCategory.SALE,
  ExpenseCategory.FREELANCE,
  ExpenseCategory.INVESTMENT,
  ExpenseCategory.OTHER,
];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.FOOD_MARKET,
  ExpenseCategory.RESTAURANT,
  ExpenseCategory.HOUSING,
  ExpenseCategory.TRANSPORTATION,
  ExpenseCategory.HEALTH,
  ExpenseCategory.UTILITIES,
  ExpenseCategory.SUBSCRIPTIONS,
  ExpenseCategory.LEISURE,
  ExpenseCategory.OTHER,
];

export default function ExpensesScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
  const [filterMode, setFilterMode] = useState<'MONTH' | 'PERIOD'>('MONTH');

  // Custom period states (DD/MM/AAAA)
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [appliedPeriod, setAppliedPeriod] = useState<{ start?: string; end?: string }>({});
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);

  const [activeScope, setActiveScope] = useState<'ALL' | 'SHARED' | 'PRIVATE' | 'PARTNER'>('ALL');
  const [activeType, setActiveType] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDto | null>(null);

  // Form State (Create / Edit)
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.FOOD_MARKET);
  const [scope, setScope] = useState<RecordScope>(RecordScope.PRIVATE);
  const [customDate, setCustomDate] = useState('');

  // Format month string "YYYY-MM"
  const currentMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const backendScope = activeScope === 'PARTNER' ? 'PRIVATE' : activeScope;
  const {
    expenses: rawExpenses,
    summary,
    isLoading,
    createExpense,
    isCreating,
    updateExpense,
    isUpdating,
    deleteExpense,
    refetch,
    isRefetching,
  } = useExpenses({
    ...(filterMode === 'MONTH'
      ? { month: currentMonthStr }
      : {
        startDate: appliedPeriod.start,
        endDate: appliedPeriod.end,
      }),
    scope: backendScope,
    type: activeType === 'ALL' ? undefined : activeType,
  });

  const expenses = useMemo(() => {
    if (!rawExpenses) return [];
    if (activeScope === 'PARTNER') {
      return rawExpenses.filter((e) => e.scope === 'PRIVATE' && !!user?.id && e.userId !== user.id);
    }
    if (activeScope === 'PRIVATE') {
      return rawExpenses.filter((e) => e.scope === 'PRIVATE' && (!user?.id || e.userId === user.id));
    }
    return rawExpenses;
  }, [rawExpenses, activeScope, user?.id]);

  // Navigation handlers for month
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  // Convert DD/MM/AAAA to ISO or YYYY-MM-DD
  const parseDateInput = (str: string) => {
    const parts = str.trim().split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const handleApplyPeriod = () => {
    const startIso = periodStartDate ? parseDateInput(periodStartDate) : undefined;
    const endIso = periodEndDate ? parseDateInput(periodEndDate) : undefined;

    if (periodStartDate && !startIso) {
      Alert.alert('Data Inválida', 'Preencha a data inicial no formato DD/MM/AAAA (ex: 01/10/2026)');
      return;
    }
    if (periodEndDate && !endIso) {
      Alert.alert('Data Inválida', 'Preencha a data final no formato DD/MM/AAAA (ex: 31/10/2026)');
      return;
    }

    setAppliedPeriod({ start: startIso, end: endIso });
  };

  const handleClearPeriod = () => {
    setPeriodStartDate('');
    setPeriodEndDate('');
    setAppliedPeriod({});
  };

  // Open Create
  const handleOpenCreate = () => {
    setDescription('');
    setAmount('');
    const initialType = activeType === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE;
    setTransactionType(initialType);
    setCategory(initialType === TransactionType.INCOME ? ExpenseCategory.SALARY : ExpenseCategory.FOOD_MARKET);
    setScope(RecordScope.PRIVATE);
    setCustomDate('');
    setCreateModalVisible(true);
  };

  // Open Edit
  const handleOpenEdit = (item: ExpenseDto) => {
    setEditingExpense(item);
    setDescription(item.description);
    setAmount(maskCurrency(item.amount));
    setTransactionType(item.type || TransactionType.EXPENSE);
    setCategory(item.category);
    setScope(item.scope);
    const d = new Date(item.date);
    const formattedD = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    setCustomDate(maskDate(formattedD));
    setEditModalVisible(true);
  };

  // Submit Create
  const handleCreate = async () => {
    const numAmount = unmaskCurrency(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Atenção', 'Informe uma descrição e um valor válido maior que zero.');
      return;
    }

    let isoDate: string | undefined = undefined;
    if (customDate) {
      const parsed = parseDateInput(customDate);
      if (parsed) isoDate = new Date(parsed).toISOString();
    }

    try {
      await createExpense({
        description: description.trim(),
        amount: numAmount,
        type: transactionType,
        category,
        scope,
        date: isoDate,
      });
      setCreateModalVisible(false);
    } catch {
      Alert.alert('Erro', `Não foi possível salvar o ${transactionType === TransactionType.INCOME ? 'ganho' : 'gasto'}.`);
    }
  };

  // Submit Edit
  const handleUpdate = async () => {
    if (!editingExpense) return;
    const numAmount = unmaskCurrency(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Atenção', 'Informe uma descrição e um valor válido maior que zero.');
      return;
    }

    let isoDate: string | undefined = undefined;
    if (customDate) {
      const parsed = parseDateInput(customDate);
      if (parsed) isoDate = new Date(parsed).toISOString();
    }

    try {
      await updateExpense({
        id: editingExpense.id,
        dto: {
          description: description.trim(),
          amount: numAmount,
          type: transactionType,
          category,
          scope,
          ...(isoDate && { date: isoDate }),
        },
      });
      setEditModalVisible(false);
      setEditingExpense(null);
    } catch {
      Alert.alert('Erro', `Não foi possível atualizar o ${transactionType === TransactionType.INCOME ? 'ganho' : 'gasto'}.`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja realmente excluir "${title}"?`);
      if (confirmed) {
        try {
          await deleteExpense(id);
          if (editModalVisible) {
            setEditModalVisible(false);
            setEditingExpense(null);
          }
        } catch {
          alert('Não foi possível excluir o gasto.');
        }
      }
      return;
    }

    Alert.alert('Excluir Gasto', `Deseja realmente excluir "${title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(id);
            if (editModalVisible) {
              setEditModalVisible(false);
              setEditingExpense(null);
            }
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir o gasto.');
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;

  const isCurrentMonthActive =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;

  const totalGeral =
    (summary?.totalShared || 0) +
    (summary?.totalPrivate || 0) +
    (summary?.partnerPrivate || 0);

  const balance = summary?.balance ?? 0;
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpense = summary?.totalExpense ?? totalGeral;
  const isPositiveBalance = balance >= 0;

  const incomeCount = useMemo(
    () => rawExpenses?.filter((e) => e.type === TransactionType.INCOME).length || 0,
    [rawExpenses]
  );
  const expenseCount = useMemo(
    () => rawExpenses?.filter((e) => e.type !== TransactionType.INCOME).length || 0,
    [rawExpenses]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader title="Harry" subtitle="Financeiro & Extrato" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* TÍTULO & BOTÃO NOVO GASTO */}
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Financeiro & Extrato</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {filterMode === 'MONTH'
                ? `${MONTH_NAMES[selectedMonth - 1]} de ${selectedYear}`
                : 'Período customizado'}
            </Text>
          </View>
        </View>

        {/* HERO SUMMARY CARD */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            theme.cardShadow,
          ]}
        >
          {/* TOPO: BALANÇO / SALDO LÍQUIDO */}
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={[styles.summaryTopLabel, { color: theme.textSecondary }]}>
                Balanço Líquido (Saldo)
              </Text>
              <Text
                style={[
                  styles.summaryTopValue,
                  { color: isPositiveBalance ? (isDark ? '#34D399' : '#059669') : '#EF4444' },
                ]}
              >
                {isPositiveBalance ? `+ ${formatCurrency(balance)}` : `- ${formatCurrency(Math.abs(balance))}`}
              </Text>
            </View>
            <View
              style={[
                styles.balancePill,
                {
                  backgroundColor: isPositiveBalance
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                },
              ]}
            >
              <Text
                style={[
                  styles.balancePillText,
                  { color: isPositiveBalance ? '#10B981' : '#EF4444' },
                ]}
              >
                {isPositiveBalance ? '🟢 Superávit' : '🔴 Déficit'}
              </Text>
            </View>
          </View>

          {/* MEIO: ENTRADAS (GANHOS) & SAÍDAS (GASTOS) */}
          <View style={[styles.inOutStatsRow, { borderTopColor: theme.border }]}>
            <View style={styles.inOutStatItem}>
              <View style={styles.inOutLabelRow}>
                <Text style={{ fontSize: 13 }}>↗️</Text>
                <Text style={[styles.inOutStatLabel, { color: theme.textSecondary }]}>
                  Entradas (Ganhos)
                </Text>
              </View>
              <Text style={[styles.inOutStatValue, { color: isDark ? '#34D399' : '#059669' }]}>
                + {formatCurrency(totalIncome)}
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

            <View style={styles.inOutStatItem}>
              <View style={styles.inOutLabelRow}>
                <Text style={{ fontSize: 13 }}>↘️</Text>
                <Text style={[styles.inOutStatLabel, { color: theme.textSecondary }]}>
                  Saídas (Gastos)
                </Text>
              </View>
              <Text style={[styles.inOutStatValue, { color: isDark ? '#F87171' : '#DC2626' }]}>
                - {formatCurrency(totalExpense)}
              </Text>
            </View>
          </View>

          {/* RODAPÉ: GASTOS COMPARTILHADOS & PRIVADOS */}
          <View style={[styles.summarySplitRow, { borderTopColor: theme.border }]}>
            <View style={styles.summarySplitItem}>
              <View style={styles.splitBadgeRow}>
                <Text style={{ fontSize: 13 }}>🏠</Text>
                <Text style={[styles.summarySplitLabel, { color: theme.textSecondary }]}>
                  Gastos Casal
                </Text>
              </View>
              <Text style={[styles.summarySplitValue, { color: theme.primary }]}>
                {formatCurrency(summary?.totalShared || 0)}
              </Text>
              <Text style={[styles.summarySplitSub, { color: theme.textMuted }]}>
                Sua parte: {formatCurrency(summary?.userShareOfShared || 0)}
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

            <View style={styles.summarySplitItem}>
              <View style={styles.splitBadgeRow}>
                <Text style={{ fontSize: 13 }}>🔒</Text>
                <Text style={[styles.summarySplitLabel, { color: theme.textSecondary }]}>
                  Seu Privado
                </Text>
              </View>
              <Text style={[styles.summarySplitValue, { color: theme.textPrimary }]}>
                {formatCurrency(summary?.totalPrivate || 0)}
              </Text>
              <Text style={[styles.summarySplitSub, { color: theme.textMuted }]}>
                Individual
              </Text>
            </View>

            {!!summary?.partnerPrivate && summary.partnerPrivate > 0 ? (
              <>
                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />
                <View style={styles.summarySplitItem}>
                  <View style={styles.splitBadgeRow}>
                    <Text style={{ fontSize: 13 }}>👁️</Text>
                    <Text style={[styles.summarySplitLabel, { color: theme.textSecondary }]}>
                      Privado do Par
                    </Text>
                  </View>
                  <Text style={[styles.summarySplitValue, { color: '#8B5CF6' }]}>
                    {formatCurrency(summary.partnerPrivate)}
                  </Text>
                  <Text style={[styles.summarySplitSub, { color: theme.textMuted }]}>
                    Compartilhado
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* SELETOR DE MODO DE FILTRO (MÊS vs PERÍODO) */}
        <View style={styles.timeFilterSection}>
          <View style={[styles.modeToggle, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                filterMode === 'MONTH' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setFilterMode('MONTH')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeText,
                  { color: filterMode === 'MONTH' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                📅 Por Mês
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                filterMode === 'PERIOD' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setFilterMode('PERIOD')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeText,
                  { color: filterMode === 'PERIOD' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                📆 Período (Datas)
              </Text>
            </TouchableOpacity>
          </View>

          {filterMode === 'MONTH' ? (
            <View
              style={[
                styles.monthSelector,
                { backgroundColor: theme.surface, borderColor: theme.border },
                theme.cardShadow,
              ]}
            >
              <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={[styles.monthNavText, { color: theme.primary }]}>◀</Text>
              </TouchableOpacity>

              <View style={styles.monthLabelContainer}>
                <Text style={[styles.monthLabel, { color: theme.textPrimary }]}>
                  {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
                </Text>
                {!isCurrentMonthActive && (
                  <TouchableOpacity
                    onPress={handleCurrentMonth}
                    style={[styles.currentMonthBadge, { backgroundColor: theme.primaryLight }]}
                  >
                    <Text style={[styles.currentMonthBadgeText, { color: theme.primary }]}>
                      Voltar ao Mês Atual
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={[styles.monthNavText, { color: theme.primary }]}>▶</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.periodFormCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
                theme.cardShadow,
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.calendarTriggerCard,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                ]}
                onPress={() => setCalendarPickerVisible(true)}
                activeOpacity={0.8}
              >
                <View style={styles.calendarTriggerLeft}>
                  <Text style={{ fontSize: 22 }}>📅</Text>
                  <View>
                    <Text style={[styles.calendarTriggerLabel, { color: theme.textMuted }]}>
                      Período Selecionado
                    </Text>
                    <Text style={[styles.calendarTriggerValue, { color: theme.textPrimary }]}>
                      {periodStartDate && periodEndDate
                        ? `${periodStartDate} até ${periodEndDate}`
                        : periodStartDate
                          ? `A partir de ${periodStartDate}`
                          : 'Toque para selecionar no calendário'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.calendarOpenBadge, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.calendarOpenBadgeText, { color: theme.primary }]}>
                    Escolher ▾
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.periodActions}>
                <Button
                  title="Abrir Calendário"
                  onPress={() => setCalendarPickerVisible(true)}
                  style={{ flex: 1, height: 40 }}
                />
                {(appliedPeriod.start || appliedPeriod.end || periodStartDate || periodEndDate) && (
                  <Button
                    title="Limpar"
                    variant="ghost"
                    onPress={handleClearPeriod}
                    style={{ height: 40 }}
                  />
                )}
              </View>
            </View>
          )}
        </View>

        {/* FILTRO DE TIPO (TODOS / GASTOS / GANHOS) */}
        <View
          style={[
            styles.typeFilterContainer,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
          ]}
        >
          {(
            [
              { id: 'ALL', label: 'Todos' },
              { id: 'EXPENSE', label: '🔴 Gastos' },
              { id: 'INCOME', label: '🟢 Ganhos' },
            ] as const
          ).map(({ id, label }) => {
            const isSelected = activeType === id;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.typeFilterBtn,
                  isSelected && {
                    backgroundColor:
                      id === 'INCOME' ? '#059669' : id === 'EXPENSE' ? '#DC2626' : theme.surface,
                    borderColor:
                      id === 'INCOME' ? '#059669' : id === 'EXPENSE' ? '#DC2626' : theme.border,
                    elevation: isSelected ? 2 : 0,
                  },
                ]}
                onPress={() => setActiveType(id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.typeFilterText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SELETOR DE ESCOPO (CHIPS) */}
        <View style={styles.scopeChipsContainer}>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'SHARED', label: '🏠 Compartilhados' },
            { id: 'PRIVATE', label: '🔒 Meus Privados' },
            ...(user?.householdId || (summary?.partnerPrivate && summary.partnerPrivate > 0) || rawExpenses?.some((e) => e.scope === 'PRIVATE' && !!user?.id && e.userId !== user.id)
              ? [{ id: 'PARTNER', label: '👁️ Privados do Par' }]
              : []),
          ].map(({ id, label }) => {
            const isSelected = activeScope === id;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.scopeChip,
                  {
                    backgroundColor: isSelected
                      ? (id === 'PARTNER' ? '#8B5CF6' : theme.primary)
                      : theme.surface,
                    borderColor: isSelected
                      ? (id === 'PARTNER' ? '#8B5CF6' : theme.primary)
                      : theme.border,
                  },
                ]}
                onPress={() => setActiveScope(id as any)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* LISTAGEM DE GASTOS / GANHOS */}
        <View style={styles.listSection}>
          <Text style={[styles.listSectionTitle, { color: theme.textPrimary }]}>
            Lançamentos ({expenses.length})
          </Text>

          {expenses.length === 0 ? (
            <EmptyState
              title={
                activeScope === 'PARTNER'
                  ? 'Nenhum lançamento do par'
                  : activeType === 'INCOME'
                  ? 'Nenhum ganho encontrado'
                  : activeType === 'EXPENSE'
                  ? 'Nenhum gasto encontrado'
                  : 'Nenhum lançamento encontrado'
              }
              description={
                activeScope === 'PARTNER'
                  ? 'Seu par ainda não possui lançamentos pessoais cadastrados neste período, ou a permissão para visualização ainda não foi ativada por ele em Configurações.'
                  : filterMode === 'MONTH'
                  ? `Não há lançamentos em ${MONTH_NAMES[selectedMonth - 1]} de ${selectedYear}.`
                  : 'Não há lançamentos no período informado.'
              }
              actionTitle={activeScope === 'PARTNER' ? undefined : '+ Novo Lançamento'}
              onAction={activeScope === 'PARTNER' ? undefined : handleOpenCreate}
            />
          ) : (
            expenses.map((item) => {
              const isPartnerPrivate = item.scope === 'PRIVATE' && !!user?.id && item.userId !== user.id;
              const isIncome = item.type === TransactionType.INCOME;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.expenseCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isPartnerPrivate ? 'rgba(139, 92, 246, 0.35)' : theme.border,
                    },
                    theme.cardShadow,
                  ]}
                  activeOpacity={isPartnerPrivate ? 1 : 0.8}
                  onPress={() => !isPartnerPrivate && handleOpenEdit(item)}
                >
                  <View style={styles.cardLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <View
                        style={[
                          styles.typeBadge,
                          {
                            backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            { color: isIncome ? '#059669' : '#DC2626' },
                          ]}
                        >
                          {isIncome ? '🟢 Ganho' : '🔴 Gasto'}
                        </Text>
                      </View>
                      <Text style={[styles.cardDesc, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
                        {item.description}
                      </Text>
                    </View>

                    <Text style={[styles.cardCategory, { color: theme.textSecondary }]}>
                      {getCategoryLabel(item.category)}
                    </Text>
                    <View style={styles.cardFooter}>
                      <ScopeBadge
                        scope={item.scope}
                        authorName={item.author?.name}
                        isPartnerPrivate={isPartnerPrivate}
                      />
                      <Text style={[styles.cardDate, { color: theme.textMuted }]}>
                        {formatDate(item.date)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardRight}>
                    <Text
                      style={[
                        styles.cardAmount,
                        { color: isIncome ? (isDark ? '#34D399' : '#059669') : theme.textPrimary },
                      ]}
                    >
                      {isIncome ? `+ ${formatCurrency(item.amount)}` : `- ${formatCurrency(item.amount)}`}
                    </Text>

                    {isPartnerPrivate ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                          alignSelf: 'flex-end',
                          marginTop: 6,
                        }}
                      >
                        <Text style={{ fontSize: 10, color: '#8B5CF6', fontWeight: '700' }}>
                          👁️ Leitura
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={[
                            styles.actionIconBtn,
                            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                          ]}
                          onPress={() => handleOpenEdit(item)}
                        >
                          <Text style={{ fontSize: 13 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.actionIconBtn,
                            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                          ]}
                          onPress={() => handleDelete(item.id, item.description)}
                        >
                          <Text style={{ fontSize: 13 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB FLUTUANTE NA ZONA DO POLEGAR */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: theme.primary }, theme.fabShadow]}
        onPress={handleOpenCreate}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>Novo Lançamento</Text>
      </TouchableOpacity>

      {/* MODAL DE CALENDÁRIO RANGE */}
      <CalendarRangePickerModal
        visible={calendarPickerVisible}
        onClose={() => setCalendarPickerVisible(false)}
        initialStartDate={periodStartDate}
        initialEndDate={periodEndDate}
        onApply={(s, e) => {
          setPeriodStartDate(s);
          setPeriodEndDate(e);
          const startIso = parseDateInput(s);
          const endIso = parseDateInput(e);
          setAppliedPeriod({ start: startIso, end: endIso });
        }}
        onClear={() => {
          handleClearPeriod();
        }}
      />

      {/* MODAL DE CRIAÇÃO */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {transactionType === TransactionType.INCOME ? 'Novo Ganho (Entrada)' : 'Novo Gasto (Saída)'}
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={{ padding: 4 }}>
                <Text style={[styles.closeText, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              {/* TIPO: GASTO OU GANHO */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Tipo de Transação
              </Text>
              <View style={styles.transactionTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.transactionTypeBtn,
                    {
                      backgroundColor:
                        transactionType === TransactionType.EXPENSE
                          ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                          : theme.inputBg,
                      borderColor:
                        transactionType === TransactionType.EXPENSE ? '#DC2626' : theme.inputBorder,
                    },
                  ]}
                  onPress={() => {
                    setTransactionType(TransactionType.EXPENSE);
                    if (INCOME_CATEGORIES.includes(category)) {
                      setCategory(EXPENSE_CATEGORIES[0]);
                    }
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🔴</Text>
                  <Text
                    style={[
                      styles.transactionTypeText,
                      {
                        color:
                          transactionType === TransactionType.EXPENSE ? '#DC2626' : theme.textPrimary,
                        fontWeight: transactionType === TransactionType.EXPENSE ? '700' : '600',
                      },
                    ]}
                  >
                    Gasto (Saída)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.transactionTypeBtn,
                    {
                      backgroundColor:
                        transactionType === TransactionType.INCOME
                          ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5')
                          : theme.inputBg,
                      borderColor:
                        transactionType === TransactionType.INCOME ? '#059669' : theme.inputBorder,
                    },
                  ]}
                  onPress={() => {
                    setTransactionType(TransactionType.INCOME);
                    if (EXPENSE_CATEGORIES.includes(category)) {
                      setCategory(INCOME_CATEGORIES[0]);
                    }
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🟢</Text>
                  <Text
                    style={[
                      styles.transactionTypeText,
                      {
                        color:
                          transactionType === TransactionType.INCOME ? '#059669' : theme.textPrimary,
                        fontWeight: transactionType === TransactionType.INCOME ? '700' : '600',
                      },
                    ]}
                  >
                    Ganho (Entrada)
                  </Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Descrição"
                placeholder={
                  transactionType === TransactionType.INCOME
                    ? 'Ex: Salário do mês, Venda de notebook...'
                    : 'Ex: Supermercado Pão de Açúcar...'
                }
                value={description}
                onChangeText={setDescription}
              />

              <Input
                label="Valor"
                placeholder="R$ 0,00"
                mask="currency"
                value={amount}
                onChangeText={setAmount}
              />

              <Input
                label="Data (Opcional - DD/MM/AAAA)"
                placeholder="DD/MM/AAAA (em branco para hoje)"
                mask="date"
                value={customDate}
                onChangeText={setCustomDate}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Escopo {transactionType === TransactionType.INCOME ? 'do Ganho' : 'do Gasto'}
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.SHARED ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.SHARED ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.SHARED)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🏠</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.SHARED ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Compartilhado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.PRIVATE ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.PRIVATE ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.PRIVATE)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🔒</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.PRIVATE ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Privado (Individual)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>
                Categoria
              </Text>
              <View style={styles.categoryGrid}>
                {(transactionType === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => {
                  const isCatSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: isCatSelected ? theme.primary : theme.surfaceSubtle,
                          borderColor: isCatSelected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catText,
                          {
                            color: isCatSelected ? '#FFFFFF' : theme.textPrimary,
                            fontWeight: isCatSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {getCategoryLabel(cat)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title={transactionType === TransactionType.INCOME ? 'Salvar Ganho' : 'Salvar Gasto'}
                onPress={handleCreate}
                isLoading={isCreating}
                style={{ marginTop: 24, marginBottom: 40 }}
              />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL DE EDIÇÃO */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {transactionType === TransactionType.INCOME ? 'Editar Ganho' : 'Editar Gasto'}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ padding: 4 }}>
                <Text style={[styles.closeText, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              {/* TIPO: GASTO OU GANHO */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Tipo de Transação
              </Text>
              <View style={styles.transactionTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.transactionTypeBtn,
                    {
                      backgroundColor:
                        transactionType === TransactionType.EXPENSE
                          ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                          : theme.inputBg,
                      borderColor:
                        transactionType === TransactionType.EXPENSE ? '#DC2626' : theme.inputBorder,
                    },
                  ]}
                  onPress={() => {
                    setTransactionType(TransactionType.EXPENSE);
                    if (INCOME_CATEGORIES.includes(category)) {
                      setCategory(EXPENSE_CATEGORIES[0]);
                    }
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🔴</Text>
                  <Text
                    style={[
                      styles.transactionTypeText,
                      {
                        color:
                          transactionType === TransactionType.EXPENSE ? '#DC2626' : theme.textPrimary,
                        fontWeight: transactionType === TransactionType.EXPENSE ? '700' : '600',
                      },
                    ]}
                  >
                    Gasto (Saída)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.transactionTypeBtn,
                    {
                      backgroundColor:
                        transactionType === TransactionType.INCOME
                          ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5')
                          : theme.inputBg,
                      borderColor:
                        transactionType === TransactionType.INCOME ? '#059669' : theme.inputBorder,
                    },
                  ]}
                  onPress={() => {
                    setTransactionType(TransactionType.INCOME);
                    if (EXPENSE_CATEGORIES.includes(category)) {
                      setCategory(INCOME_CATEGORIES[0]);
                    }
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🟢</Text>
                  <Text
                    style={[
                      styles.transactionTypeText,
                      {
                        color:
                          transactionType === TransactionType.INCOME ? '#059669' : theme.textPrimary,
                        fontWeight: transactionType === TransactionType.INCOME ? '700' : '600',
                      },
                    ]}
                  >
                    Ganho (Entrada)
                  </Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Descrição"
                placeholder={
                  transactionType === TransactionType.INCOME
                    ? 'Ex: Salário do mês, Venda...'
                    : 'Ex: Supermercado...'
                }
                value={description}
                onChangeText={setDescription}
              />

              <Input
                label="Valor"
                placeholder="R$ 0,00"
                mask="currency"
                value={amount}
                onChangeText={setAmount}
              />

              <Input
                label="Data (DD/MM/AAAA)"
                placeholder="DD/MM/AAAA"
                mask="date"
                value={customDate}
                onChangeText={setCustomDate}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Escopo {transactionType === TransactionType.INCOME ? 'do Ganho' : 'do Gasto'}
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.SHARED ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.SHARED ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.SHARED)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🏠</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.SHARED ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Compartilhado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    {
                      backgroundColor: scope === RecordScope.PRIVATE ? theme.primaryLight : theme.inputBg,
                      borderColor: scope === RecordScope.PRIVATE ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setScope(RecordScope.PRIVATE)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🔒</Text>
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: scope === RecordScope.PRIVATE ? theme.primary : theme.textPrimary },
                    ]}
                  >
                    Privado (Individual)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 16 }]}>
                Categoria
              </Text>
              <View style={styles.categoryGrid}>
                {(transactionType === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => {
                  const isCatSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: isCatSelected ? theme.primary : theme.surfaceSubtle,
                          borderColor: isCatSelected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catText,
                          {
                            color: isCatSelected ? '#FFFFFF' : theme.textPrimary,
                            fontWeight: isCatSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {getCategoryLabel(cat)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
                <Button
                  title="Salvar Alterações"
                  onPress={handleUpdate}
                  isLoading={isUpdating}
                />
                {editingExpense && (
                  <Button
                    title={transactionType === TransactionType.INCOME ? 'Excluir Ganho' : 'Excluir Gasto'}
                    variant="ghost"
                    onPress={() => handleDelete(editingExpense.id, editingExpense.description)}
                    style={{ borderColor: theme.danger, borderWidth: 1 }}
                  />
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 80,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  summaryCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryTopRow: {
    marginBottom: 12,
  },
  summaryTopLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryTopValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  summarySplitRow: {
    flexDirection: 'row',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summarySplitItem: {
    flex: 1,
  },
  splitBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summarySplitLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  summarySplitValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  summarySplitSub: {
    fontSize: 10,
    marginTop: 2,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  timeFilterSection: {
    marginBottom: 14,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  monthNavBtn: {
    padding: 6,
  },
  monthNavText: {
    fontSize: 16,
    fontWeight: '800',
  },
  monthLabelContainer: {
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  currentMonthBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentMonthBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  periodFormCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  calendarTriggerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  calendarTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  calendarTriggerLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  calendarTriggerValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  calendarOpenBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  calendarOpenBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  periodActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  scopeChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  scopeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  scopeChipText: {
    fontSize: 12,
  },
  listSection: {
    marginTop: 4,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  cardDesc: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  cardDate: {
    fontSize: 11,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 26,
    gap: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  scopeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  scopeOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  catText: {
    fontSize: 12,
  },
  typeFilterContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    gap: 4,
  },
  typeFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeFilterText: {
    fontSize: 13,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  transactionTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  transactionTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  transactionTypeText: {
    fontSize: 14,
  },
  balancePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  balancePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inOutStatsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  inOutStatItem: {
    flex: 1,
  },
  inOutLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  inOutStatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inOutStatValue: {
    fontSize: 15,
    fontWeight: '800',
  },
});
