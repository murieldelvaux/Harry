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
import { CalendarDatePicker } from '../../src/components/CalendarDatePicker';
import { PartnerSelect } from '../../src/components/PartnerSelect';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import { useExpenses, useExpenseSettlements, useExpenseAnalytics } from '../../src/hooks/useExpenses';
import { useHousehold } from '../../src/hooks/useHousehold';
import { useAuth } from '../../src/hooks/useAuth';
import {
  formatCurrency,
  formatDate,
  getCategoryLabel,
  maskCurrency,
  unmaskCurrency,
  maskDate,
  parseIsoToBrDate,
  parseBrDateToIso,
} from '../../src/utils/format';
import { ExpenseCategory, RecordScope, TransactionType, ExpenseDto, SettlementStatus } from '../../../packages/shared/src';

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

const getTodayBrDate = () => {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

export default function ExpensesScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { household } = useHousehold();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
  const [filterMode, setFilterMode] = useState<'MONTH' | 'PERIOD'>('MONTH');
  const [activeTab, setActiveTab] = useState<'EXTRATO' | 'CLOSING' | 'ANALYTICS'>('EXTRATO');

  // Custom period states (DD/MM/AAAA)
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [appliedPeriod, setAppliedPeriod] = useState<{ start?: string; end?: string }>({});
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);

  const [activeScope, setActiveScope] = useState<'ALL' | 'SHARED' | 'PRIVATE' | 'PARTNER'>('ALL');
  const [activeType, setActiveType] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [balanceViewMode, setBalanceViewMode] = useState<'INDIVIDUAL' | 'JOINT'>('INDIVIDUAL');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDto | null>(null);

  // Form State (Create / Edit)
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.FOOD_MARKET);
  const [scope, setScope] = useState<RecordScope>(RecordScope.SHARED);
  const [paidByUserId, setPaidByUserId] = useState<string>(user?.id || '');
  const [customDate, setCustomDate] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState(2);

  // Format month string "YYYY-MM"
  const currentMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const periodQuery = filterMode === 'MONTH'
    ? { month: currentMonthStr }
    : { startDate: appliedPeriod.start, endDate: appliedPeriod.end };

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
  } = useExpenses(periodQuery);

  const {
    preview: settlementPreview,
    isLoadingPreview,
    settlements,
    createSettlement,
    isCreatingSettlement,
    settleAccountClosing,
    isSettling,
    reopenSettlement,
    isReopening,
  } = useExpenseSettlements({
    ...periodQuery,
    enabled: true,
  });

  const {
    analytics,
    isLoadingAnalytics,
  } = useExpenseAnalytics({
    ...periodQuery,
    scope: activeScope === 'SHARED' || activeScope === 'PRIVATE' ? activeScope : undefined,
    enabled: true,
  });

  const partnerMembers = useMemo(() => {
    if (household?.members && household.members.length > 0) {
      return household.members.map((m: any) => ({
        id: m.id,
        name: m.name,
        email: m.email,
      }));
    }
    if (user) {
      return [{ id: user.id, name: user.name, email: user.email }];
    }
    return [];
  }, [household?.members, user]);

  const expenses = useMemo(() => {
    if (!rawExpenses || !Array.isArray(rawExpenses)) return [];
    let list = rawExpenses;

    // Filtro por Tipo (Gasto ou Ganho)
    if (activeType === 'EXPENSE') {
      list = list.filter((e) => e?.type !== TransactionType.INCOME);
    } else if (activeType === 'INCOME') {
      list = list.filter((e) => e?.type === TransactionType.INCOME);
    }

    // Filtro por Escopo
    if (activeScope === 'SHARED') {
      list = list.filter((e) => e?.scope === 'SHARED');
    } else if (activeScope === 'PRIVATE') {
      list = list.filter((e) => e?.scope === 'PRIVATE' && (!user?.id || e.userId === user.id));
    } else if (activeScope === 'PARTNER') {
      list = list.filter((e) => e?.scope === 'PRIVATE' && !!user?.id && e.userId !== user.id);
    }

    return list;
  }, [rawExpenses, activeScope, activeType, user?.id]);


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
    setScope(user?.householdId ? RecordScope.SHARED : RecordScope.PRIVATE);
    setPaidByUserId(user?.id || '');
    setCustomDate('');
    setIsInstallment(false);
    setTotalInstallments(2);
    setCreateModalVisible(true);
  };

  // Open Edit
  const handleOpenEdit = (item: ExpenseDto) => {
    setEditingExpense(item);
    const cleanDesc = item.description.replace(/\s*\(\d+\/\d+\)$/, '').trim();
    setDescription(cleanDesc);

    const isInst = !!(item.totalInstallments && item.totalInstallments > 1);
    setIsInstallment(isInst);
    setTotalInstallments(item.totalInstallments || 2);

    const fullAmount = isInst ? Number(item.amount) * (item.totalInstallments || 1) : Number(item.amount);
    setAmount(maskCurrency(fullAmount));

    setTransactionType(item.type || TransactionType.EXPENSE);
    setCategory(item.category);
    setScope(item.scope);
    setPaidByUserId(item.paidByUserId || item.userId || user?.id || '');
    setCustomDate(parseIsoToBrDate(item.date));
    setEditModalVisible(true);
  };

  // Submit Create
  const handleCreate = async () => {
    const numAmount = unmaskCurrency(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Atenção', 'Informe uma descrição e um valor válido maior que zero.');
      return;
    }

    const isoDate = parseBrDateToIso(customDate) || parseBrDateToIso(getTodayBrDate());

    try {
      await createExpense({
        description: description.trim(),
        amount: numAmount,
        type: transactionType,
        category,
        scope,
        paidByUserId: scope === RecordScope.SHARED ? (paidByUserId || user?.id) : user?.id,
        date: isoDate,
        totalInstallments: (transactionType === TransactionType.EXPENSE && isInstallment && totalInstallments > 1)
          ? totalInstallments
          : undefined,
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

    const isoDate = parseBrDateToIso(customDate);

    try {
      await updateExpense({
        id: editingExpense.id,
        dto: {
          description: description.trim(),
          amount: numAmount,
          type: transactionType,
          category,
          scope,
          paidByUserId: scope === RecordScope.SHARED ? (paidByUserId || editingExpense.userId) : editingExpense.userId,
          ...(isoDate && { date: isoDate }),
          totalInstallments: (transactionType === TransactionType.EXPENSE && isInstallment && totalInstallments > 1)
            ? totalInstallments
            : (editingExpense.totalInstallments ? 1 : undefined),
        },
      });
      setEditModalVisible(false);
      setEditingExpense(null);
    } catch {
      Alert.alert('Erro', `Não foi possível atualizar o ${transactionType === TransactionType.INCOME ? 'ganho' : 'gasto'}.`);
    }
  };

  const handleCloseAccounts = async () => {
    if (!settlementPreview) return;
    try {
      await createSettlement({
        periodStart: settlementPreview.periodStart,
        periodEnd: settlementPreview.periodEnd,
        notes: closingNotes.trim() || undefined,
      });
      setClosingNotes('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Não foi possível realizar o fechamento de contas.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Atenção', msg);
    }
  };

  const handleSettleClosing = async (id: string) => {
    try {
      await settleAccountClosing(id);
    } catch {
      if (Platform.OS === 'web') alert('Erro ao marcar fechamento como pago.');
      else Alert.alert('Erro', 'Não foi possível liquidar o fechamento.');
    }
  };

  const handleReopenClosing = async (id: string) => {
    try {
      await reopenSettlement(id);
    } catch {
      if (Platform.OS === 'web') alert('Erro ao reabrir fechamento.');
      else Alert.alert('Erro', 'Não foi possível reabrir o fechamento.');
    }
  };

  const handleDelete = async (id: string, title: string, item?: ExpenseDto | null) => {
    const isInst = item?.installmentGroupId && (item.totalInstallments || 0) > 1;

    if (isInst) {
      if (Platform.OS === 'web') {
        const deleteGroup = window.confirm(
          `Esta despesa é parcelada (${item?.installmentNumber}/${item?.totalInstallments}) de "${title}".\n\nClique em OK para excluir TODAS as parcelas deste grupo.\nClique em Cancelar se desejar excluir apenas esta parcela.`
        );
        if (deleteGroup) {
          try {
            await deleteExpense({ id, deleteAll: true });
            if (editModalVisible) {
              setEditModalVisible(false);
              setEditingExpense(null);
            }
          } catch {
            alert('Não foi possível excluir as parcelas.');
          }
          return;
        }

        const deleteSingle = window.confirm(`Deseja excluir APENAS esta parcela (${item?.installmentNumber}/${item?.totalInstallments})?`);
        if (deleteSingle) {
          try {
            await deleteExpense(id);
            if (editModalVisible) {
              setEditModalVisible(false);
              setEditingExpense(null);
            }
          } catch {
            alert('Não foi possível excluir a parcela.');
          }
        }
        return;
      }

      Alert.alert(
        'Excluir Compra Parcelada',
        `Esta despesa é parcelada (${item?.installmentNumber}/${item?.totalInstallments}) de "${title}". O que deseja excluir?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Apenas esta parcela',
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
          {
            text: `Todas as ${item?.totalInstallments} parcelas`,
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteExpense({ id, deleteAll: true });
                if (editModalVisible) {
                  setEditModalVisible(false);
                  setEditingExpense(null);
                }
              } catch {
                Alert.alert('Erro', 'Não foi possível excluir as parcelas.');
              }
            },
          },
        ]
      );
      return;
    }

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

  // Balanço Individual (Visão Pessoal do Usuário)
  // Suas compras pessoais + Sua metade dos gastos compartilhados
  // Os gastos privados do parceiro NÃO são descontados daqui!
  const myIncome = summary?.myIncome ?? (summary?.totalIncome ?? 0);
  const myPrivateExpenses = summary?.myPrivateExpenses ?? (summary?.totalPrivate ?? 0);
  const myShareOfShared = summary?.myShareOfSharedExpenses ?? (summary?.userShareOfShared ?? 0);
  const myTotalExpenses = summary?.myTotalExpenses ?? (myPrivateExpenses + myShareOfShared);
  const myBalance = summary?.myBalance ?? (myIncome - myTotalExpenses);
  const isMyPositiveBalance = myBalance >= 0;

  // Balanço em Conjunto (Visão Casal / Casa)
  // Contas compartilhadas da residência
  const jointIncome = summary?.jointIncome ?? (summary?.totalIncome ?? 0);
  const jointExpenses = summary?.jointExpenses ?? (summary?.totalShared ?? 0);
  const jointBalance = summary?.jointBalance ?? (jointIncome - jointExpenses);
  const isJointPositiveBalance = jointBalance >= 0;

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

        {/* HERO SUMMARY CARD COM SELETOR INDIVIDUAL VS CONJUNTO */}
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
          {/* SELETOR DE MODO DE BALANÇO: INDIVIDUAL VS EM CONJUNTO */}
          <View
            style={[
              styles.balanceModeToggle,
              { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.balanceModeBtn,
                balanceViewMode === 'INDIVIDUAL' && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                  elevation: 2,
                },
              ]}
              onPress={() => setBalanceViewMode('INDIVIDUAL')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.balanceModeText,
                  {
                    color: balanceViewMode === 'INDIVIDUAL' ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: balanceViewMode === 'INDIVIDUAL' ? '700' : '600',
                  },
                ]}
              >
                👤 Meu Balanço Individual
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.balanceModeBtn,
                balanceViewMode === 'JOINT' && {
                  backgroundColor: '#8B5CF6',
                  borderColor: '#8B5CF6',
                  elevation: 2,
                },
              ]}
              onPress={() => setBalanceViewMode('JOINT')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.balanceModeText,
                  {
                    color: balanceViewMode === 'JOINT' ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: balanceViewMode === 'JOINT' ? '700' : '600',
                  },
                ]}
              >
                👥 Em Conjunto (Casal)
              </Text>
            </TouchableOpacity>
          </View>

          {balanceViewMode === 'INDIVIDUAL' ? (
            <>
              {/* TOPO: MEU SALDO INDIVIDUAL */}
              <View style={styles.summaryTopRow}>
                <View>
                  <Text style={[styles.summaryTopLabel, { color: theme.textSecondary }]}>
                    Meu Saldo Individual
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                    Suas entradas menos suas despesas reais
                  </Text>
                  <Text
                    style={[
                      styles.summaryTopValue,
                      { color: isMyPositiveBalance ? (isDark ? '#34D399' : '#059669') : '#EF4444' },
                    ]}
                  >
                    {isMyPositiveBalance ? `+ ${formatCurrency(myBalance)}` : `- ${formatCurrency(Math.abs(myBalance))}`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.balancePill,
                    {
                      backgroundColor: isMyPositiveBalance
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.balancePillText,
                      { color: isMyPositiveBalance ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {isMyPositiveBalance ? '🟢 Saldo Positivo' : '🔴 Em Déficit'}
                  </Text>
                </View>
              </View>

              {/* MEIO: MEUS GANHOS & MEUS GASTOS REAIS */}
              <View style={[styles.inOutStatsRow, { borderTopColor: theme.border }]}>
                <View style={styles.inOutStatItem}>
                  <View style={styles.inOutLabelRow}>
                    <Text style={{ fontSize: 13 }}>↗️</Text>
                    <Text style={[styles.inOutStatLabel, { color: theme.textSecondary }]}>
                      Meus Ganhos
                    </Text>
                  </View>
                  <Text style={[styles.inOutStatValue, { color: isDark ? '#34D399' : '#059669' }]}>
                    + {formatCurrency(myIncome)}
                  </Text>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

                <View style={styles.inOutStatItem}>
                  <View style={styles.inOutLabelRow}>
                    <Text style={{ fontSize: 13 }}>↘️</Text>
                    <Text style={[styles.inOutStatLabel, { color: theme.textSecondary }]}>
                      Meus Gastos Reais
                    </Text>
                  </View>
                  <Text style={[styles.inOutStatValue, { color: isDark ? '#F87171' : '#DC2626' }]}>
                    - {formatCurrency(myTotalExpenses)}
                  </Text>
                </View>
              </View>

              {/* COMPOSIÇÃO DOS MEUS GASTOS */}
              <View style={[styles.summarySplitRow, { borderTopColor: theme.border }]}>
                <View style={styles.summarySplitItem}>
                  <View style={styles.splitBadgeRow}>
                    <Text style={{ fontSize: 13 }}>🔒</Text>
                    <Text style={[styles.summarySplitLabel, { color: theme.textSecondary }]}>
                      Seus Gastos Privados
                    </Text>
                  </View>
                  <Text style={[styles.summarySplitValue, { color: theme.textPrimary }]}>
                    {formatCurrency(myPrivateExpenses)}
                  </Text>
                  <Text style={[styles.summarySplitSub, { color: theme.textMuted }]}>
                    100% individual seu
                  </Text>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

                <View style={styles.summarySplitItem}>
                  <View style={styles.splitBadgeRow}>
                    <Text style={{ fontSize: 13 }}>🏠</Text>
                    <Text style={[styles.summarySplitLabel, { color: theme.textSecondary }]}>
                      Sua Cota da Casa (50%)
                    </Text>
                  </View>
                  <Text style={[styles.summarySplitValue, { color: theme.primary }]}>
                    {formatCurrency(myShareOfShared)}
                  </Text>
                  <Text style={[styles.summarySplitSub, { color: theme.textMuted }]}>
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
              <View style={styles.summaryTopRow}>
                <View>
                  <Text style={[styles.summaryTopLabel, { color: theme.textSecondary }]}>
                    Balanço em Conjunto (Casal)
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                    Contas e despesas conjuntas da residência
                  </Text>
                  <Text
                    style={[
                      styles.summaryTopValue,
                      { color: isJointPositiveBalance ? (isDark ? '#34D399' : '#059669') : '#EF4444' },
                    ]}
                  >
                    {isJointPositiveBalance ? `+ ${formatCurrency(jointBalance)}` : `- ${formatCurrency(Math.abs(jointBalance))}`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.balancePill,
                    {
                      backgroundColor: isJointPositiveBalance
                        ? 'rgba(139, 92, 246, 0.15)'
                        : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.balancePillText,
                      { color: isJointPositiveBalance ? '#8B5CF6' : '#EF4444' },
                    ]}
                  >
                    {isJointPositiveBalance ? '👥 Superávit Casa' : '🔴 Déficit Casa'}
                  </Text>
                </View>
              </View>

              {/* MEIO: RENDA CONJUNTA & DESPESAS DA CASA */}
              <View style={[styles.inOutStatsRow, { borderTopColor: theme.border }]}>
                <View style={styles.inOutStatItem}>
                  <View style={styles.inOutLabelRow}>
                    <Text style={{ fontSize: 13 }}>↗️</Text>
                    <Text style={[styles.inOutStatLabel, { color: theme.textSecondary }]}>
                      Renda Conjunta
                    </Text>
                  </View>
                  <Text style={[styles.inOutStatValue, { color: isDark ? '#34D399' : '#059669' }]}>
                    + {formatCurrency(jointIncome)}
                  </Text>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

                <View style={styles.inOutStatItem}>
                  <View style={styles.inOutLabelRow}>
                    <Text style={{ fontSize: 13 }}>↘️</Text>
                    <Text style={[styles.inOutStatLabel, { color: theme.textSecondary }]}>
                      Despesas da Casa
                    </Text>
                  </View>
                  <Text style={[styles.inOutStatValue, { color: isDark ? '#F87171' : '#DC2626' }]}>
                    - {formatCurrency(jointExpenses)}
                  </Text>
                </View>
              </View>

              {/* RATEIO DA CASA */}
              <View style={[styles.summarySplitRow, { borderTopColor: theme.border }]}>
                <View style={styles.summarySplitItem}>
                  <View style={styles.splitBadgeRow}>
                    <Text style={{ fontSize: 13 }}>🏠</Text>
                    <Text style={[styles.summarySplitLabel, { color: theme.textSecondary }]}>
                      Total da Casa
                    </Text>
                  </View>
                  <Text style={[styles.summarySplitValue, { color: theme.primary }]}>
                    {formatCurrency(summary?.totalShared || 0)}
                  </Text>
                  <Text style={[styles.summarySplitSub, { color: theme.textMuted }]}>
                    Contas compartilhadas
                  </Text>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

                <View style={styles.summarySplitItem}>
                  <View style={styles.splitBadgeRow}>
                    <Text style={{ fontSize: 13 }}>⚖️</Text>
                    <Text style={[styles.summarySplitLabel, { color: theme.textSecondary }]}>
                      Divisão 50/50
                    </Text>
                  </View>
                  <Text style={[styles.summarySplitValue, { color: theme.textPrimary }]}>
                    {formatCurrency(summary?.userShareOfShared || 0)} cada
                  </Text>
                  <Text style={[styles.summarySplitSub, { color: theme.textMuted }]}>
                    Sua parte e do par
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
                        Individual dele
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            </>
          )}
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
              <TouchableOpacity testID="prev-month-btn" onPress={handlePrevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
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

              <TouchableOpacity testID="next-month-btn" onPress={handleNextMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
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

        {/* ABAS DE VISÃO: EXTRATO | FECHAR CONTAS | ANÁLISE */}
        <View
          style={[
            styles.typeFilterContainer,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, marginBottom: 16 },
          ]}
        >
          {(
            [
              { id: 'EXTRATO', label: '📋 Extrato', testID: 'expenses-tab-extrato' },
              { id: 'CLOSING', label: '⚖️ Fechar Contas', testID: 'expenses-tab-closing' },
              { id: 'ANALYTICS', label: '📊 Análise', testID: 'expenses-tab-analytics' },
            ] as const
          ).map(({ id, label, testID }) => {
            const isSelected = activeTab === id;
            return (
              <TouchableOpacity
                key={id}
                testID={testID}
                style={[
                  styles.typeFilterBtn,
                  isSelected && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                    elevation: 2,
                  },
                ]}
                onPress={() => setActiveTab(id)}
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

        {activeTab === 'EXTRATO' && (
          <>
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
              const payerName = item.paidBy?.name || item.author?.name || '';
              return (
                <TouchableOpacity
                  key={item.id}
                  testID={`expense-card-${item.id}`}
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
                    <View style={[styles.cardFooter, { flexWrap: 'wrap' }]}>
                      <ScopeBadge
                        scope={item.scope}
                        authorName={item.author?.name}
                        isPartnerPrivate={isPartnerPrivate}
                      />
                      {item.scope === RecordScope.SHARED && payerName ? (
                        <View
                          testID={`expense-payer-badge-${item.id}`}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 8,
                            backgroundColor: theme.primaryLight,
                          }}
                        >
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.primary }}>
                            💳 Pago por: {payerName.split(' ')[0]}
                          </Text>
                        </View>
                      ) : null}
                      {item.settlementId ? (
                        <View
                          style={{
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 8,
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>
                            ✓ Fechado
                          </Text>
                        </View>
                      ) : null}
                      {item.totalInstallments && item.totalInstallments > 1 ? (
                        <View
                          testID={`expense-installment-badge-${item.id}`}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 8,
                            backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE',
                            borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : '#DDD6FE',
                            borderWidth: 1,
                          }}
                        >
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#A78BFA' : '#6D28D9' }}>
                            💳 {item.installmentNumber}/{item.totalInstallments}
                          </Text>
                        </View>
                      ) : null}
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
                          onPress={() => handleDelete(item.id, item.description, item)}
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
          </>
        )}

        {/* VISÃO DE FECHAMENTO DE CONTAS (TASKS 4 & 5) */}
        {activeTab === 'CLOSING' && (
          <View style={{ gap: 16 }} testID="expenses-closing-view">
            {/* CARD DE PRÉVIA & ENCONTRO DE CONTAS */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 },
                theme.cardShadow,
              ]}
            >
              <Text style={[styles.listSectionTitle, { color: theme.textPrimary, fontSize: 16 }]}>
                ⚖️ Encontro de Contas do Período (50/50)
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 14 }}>
                Consolidação das despesas compartilhadas pendentes e cálculo líquido de quem deve transferir para quem.
              </Text>

              {/* TOTAIS DO PERÍODO */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: theme.surfaceSubtle,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: '700' }}>
                    TOTAL COMPARTILHADO
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginTop: 4 }}>
                    {formatCurrency(settlementPreview?.totalShared || 0)}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                    {settlementPreview?.pendingExpensesCount || 0} conta(s) pendente(s)
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: theme.surfaceSubtle,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: '700' }}>
                    QUOTA POR PARCEIRO (50%)
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.primary, marginTop: 4 }}>
                    {formatCurrency(settlementPreview?.quotaPerPartner || 0)}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                    Divisão igualitária
                  </Text>
                </View>
              </View>

              {/* BREAKDOWN POR MEMBRO DO CASAL */}
              {settlementPreview?.membersBreakdown && settlementPreview.membersBreakdown.length > 0 && (
                <View style={{ gap: 8, marginBottom: 14 }}>
                  {settlementPreview.membersBreakdown.map((mb) => {
                    const isCreditor = mb.netBalance > 0;
                    const isDebtor = mb.netBalance < 0;
                    return (
                      <View
                        key={mb.userId}
                        testID={`member-breakdown-${mb.userId}`}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: theme.surfaceSubtle,
                          borderWidth: 1,
                          borderColor: theme.border,
                        }}
                      >
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                            👤 {mb.name}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                            Pagou: {formatCurrency(mb.paidAmount)} • Quota: {formatCurrency(mb.quotaAmount)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '800',
                              color: isCreditor ? '#059669' : isDebtor ? '#DC2626' : theme.textSecondary,
                            }}
                          >
                            {isCreditor
                              ? `+ ${formatCurrency(mb.netBalance)}`
                              : isDebtor
                              ? `- ${formatCurrency(Math.abs(mb.netBalance))}`
                              : formatCurrency(0)}
                          </Text>
                          <Text style={{ fontSize: 10.5, color: theme.textMuted }}>
                            {isCreditor ? 'A receber' : isDebtor ? 'A transferir' : 'Quite'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* DESTAQUE VISUAL: QUEM DEVE TRANSFERIR PARA QUEM E O VALOR EXATO */}
              <View
                testID="settlement-transfer-card"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor:
                    settlementPreview?.transferInstruction && !settlementPreview.transferInstruction.isEven
                      ? theme.primaryLight
                      : 'rgba(16, 185, 129, 0.12)',
                  borderWidth: 1.5,
                  borderColor:
                    settlementPreview?.transferInstruction && !settlementPreview.transferInstruction.isEven
                      ? theme.primary
                      : '#10B981',
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    color:
                      settlementPreview?.transferInstruction && !settlementPreview.transferInstruction.isEven
                        ? theme.primary
                        : '#059669',
                    marginBottom: 4,
                  }}
                >
                  💸 Resumo da Transferência Líquida
                </Text>

                {settlementPreview?.transferInstruction && !settlementPreview.transferInstruction.isEven ? (
                  <Text
                    testID="settlement-transfer-text"
                    style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary, lineHeight: 22 }}
                  >
                    {settlementPreview.transferInstruction.fromUserName} deve transferir{' '}
                    <Text style={{ color: theme.primary, fontSize: 17 }}>
                      {formatCurrency(settlementPreview.transferInstruction.amount)}
                    </Text>{' '}
                    para {settlementPreview.transferInstruction.toUserName}
                  </Text>
                ) : (
                  <Text
                    testID="settlement-transfer-text"
                    style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}
                  >
                    ✅ Contas 100% empatadas neste período! Nenhuma transferência pendente.
                  </Text>
                )}
              </View>

              <Button
                testID="close-accounts-btn"
                title={
                  (settlementPreview?.pendingExpensesCount || 0) > 0
                    ? `🔒 Fechar Contas do Período (${settlementPreview?.pendingExpensesCount})`
                    : 'Nenhuma conta pendente para fechar'
                }
                onPress={handleCloseAccounts}
                isLoading={isCreatingSettlement}
                disabled={!settlementPreview || settlementPreview.pendingExpensesCount === 0}
              />
            </View>

            {/* HISTÓRICO DE FECHAMENTOS REALIZADOS */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 },
                theme.cardShadow,
              ]}
            >
              <Text style={[styles.listSectionTitle, { color: theme.textPrimary, fontSize: 15 }]}>
                📜 Histórico de Fechamentos ({settlements.length})
              </Text>

              {settlements.length === 0 ? (
                <Text style={{ fontSize: 13, color: theme.textSecondary, paddingVertical: 12 }}>
                  Nenhum fechamento registrado ainda. Clique em "Fechar Contas do Período" acima para consolidar o ciclo atual.
                </Text>
              ) : (
                settlements.map((s, idx) => {
                  const isSettled = s.status === SettlementStatus.SETTLED;
                  return (
                    <View
                      key={s.id}
                      testID={`settlement-history-item-${s.id}`}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: isSettled ? 'rgba(16, 185, 129, 0.35)' : theme.border,
                        backgroundColor: theme.surfaceSubtle,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                          📅 {formatDate(s.periodStart)} a {formatDate(s.periodEnd)}
                        </Text>
                        <View
                          testID={`settlement-status-${s.id}`}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                            backgroundColor: isSettled
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '800',
                              color: isSettled ? '#059669' : '#D97706',
                            }}
                          >
                            {isSettled ? '✅ LIQUIDADO / PAGO' : '⏳ AGUARDANDO PAGAMENTO'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 12.5, color: theme.textSecondary, marginBottom: 6 }}>
                        Total compartilhado: <Text style={{ fontWeight: '700' }}>{formatCurrency(s.totalShared)}</Text> ({s.expensesCount} contas)
                      </Text>

                      {s.transferAmount > 0 && s.fromUser && s.toUser ? (
                        <Text
                          style={{
                            fontSize: 13.5,
                            fontWeight: '800',
                            color: isSettled ? '#059669' : theme.primary,
                            marginBottom: 10,
                          }}
                        >
                          👉 {s.fromUser.name} ➔ {s.toUser.name}: {formatCurrency(s.transferAmount)}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#059669', marginBottom: 10 }}>
                          Contas empatadas (R$ 0,00 a transferir)
                        </Text>
                      )}

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {!isSettled && (
                          <Button
                            testID={idx === 0 ? 'settle-closing-btn' : `settle-closing-btn-${s.id}`}
                            title="✅ Marcar como Pago/Liquidado"
                            onPress={() => handleSettleClosing(s.id)}
                            isLoading={isSettling}
                            style={{ flex: 1, height: 38 }}
                          />
                        )}
                        <TouchableOpacity
                          testID={`reopen-closing-btn-${s.id}`}
                          onPress={() => handleReopenClosing(s.id)}
                          disabled={isReopening}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: theme.border,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                            ↩ Reabrir
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* VISÃO DE ANÁLISE DOS PRINCIPAIS GASTOS (TASK 6) */}
        {activeTab === 'ANALYTICS' && (
          <View style={{ gap: 16 }} testID="expenses-analytics-view">
            {/* COMPARATIVO ENTRE PERÍODOS */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 },
                theme.cardShadow,
              ]}
            >
              <Text style={[styles.listSectionTitle, { color: theme.textPrimary, fontSize: 16 }]}>
                📊 Comparativo & Evolução do Orçamento
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <View>
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>Total de Gastos no Período</Text>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginTop: 2 }}>
                    {formatCurrency(analytics?.totalExpenses || 0)}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                    Período anterior: {formatCurrency(analytics?.previousPeriodTotal || 0)}
                  </Text>
                </View>

                <View
                  testID="analytics-variation-badge"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor:
                      (analytics?.variationPercent || 0) <= 0
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'rgba(239, 68, 68, 0.14)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: (analytics?.variationPercent || 0) <= 0 ? '#059669' : '#DC2626',
                    }}
                  >
                    {(analytics?.variationPercent || 0) > 0
                      ? `▲ +${analytics?.variationPercent}% vs anterior`
                      : `▼ ${analytics?.variationPercent || 0}% vs anterior`}
                  </Text>
                </View>
              </View>
            </View>

            {/* MAIORES CATEGORIAS DE DESPESA */}
            <View
              testID="analytics-category-list"
              style={[
                styles.summaryCard,
                { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 },
                theme.cardShadow,
              ]}
            >
              <Text style={[styles.listSectionTitle, { color: theme.textPrimary, fontSize: 15 }]}>
                🏷️ Gastos por Categoria
              </Text>
              {!analytics?.byCategory || analytics.byCategory.length === 0 ? (
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  Sem despesas registradas neste período para análise por categoria.
                </Text>
              ) : (
                analytics.byCategory.map((cat) => (
                  <View key={cat.category} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                        {getCategoryLabel(cat.category)} ({cat.count})
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textPrimary }}>
                        {formatCurrency(cat.total)} ({cat.percentage}%)
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: theme.surfaceSubtle,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.min(100, Math.max(4, cat.percentage))}%`,
                          height: '100%',
                          backgroundColor: theme.primary,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* EVOLUÇÃO TEMPORAL (ÚLTIMOS 6 MESES) */}
            <View
              testID="analytics-monthly-evolution"
              style={[
                styles.summaryCard,
                { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 },
                theme.cardShadow,
              ]}
            >
              <Text style={[styles.listSectionTitle, { color: theme.textPrimary, fontSize: 15 }]}>
                📈 Evolução Temporal (Últimos 6 Meses)
              </Text>
              {(() => {
                const evo = analytics?.monthlyEvolution || [];
                const maxVal = Math.max(1, ...evo.map((m) => m.total));
                return (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {evo.map((m) => (
                      <View key={m.month} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ width: 62, fontSize: 11.5, fontWeight: '700', color: theme.textSecondary }}>
                          {m.month}
                        </Text>
                        <View
                          style={{
                            flex: 1,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: theme.surfaceSubtle,
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              width: `${Math.min(100, (m.total / maxVal) * 100)}%`,
                              height: '100%',
                              backgroundColor: '#8B5CF6',
                              borderRadius: 5,
                            }}
                          />
                        </View>
                        <Text style={{ width: 88, fontSize: 11.5, fontWeight: '700', color: theme.textPrimary, textAlign: 'right' }}>
                          {formatCurrency(m.total)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>

            {/* TOP 5 PRINCIPAIS OFENSORES DO ORÇAMENTO */}
            <View
              testID="analytics-top-offenders"
              style={[
                styles.summaryCard,
                { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 },
                theme.cardShadow,
              ]}
            >
              <Text style={[styles.listSectionTitle, { color: theme.textPrimary, fontSize: 15 }]}>
                🚨 Principais Ofensores do Orçamento (Top 5)
              </Text>
              {!analytics?.topOffenders || analytics.topOffenders.length === 0 ? (
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  Sem despesas para exibir no ranking de maiores gastos.
                </Text>
              ) : (
                analytics.topOffenders.map((off, idx) => (
                  <View
                    key={off.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 9,
                      borderBottomWidth: idx < analytics.topOffenders.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.textPrimary }} numberOfLines={1}>
                        #{idx + 1} {off.description}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                        {getCategoryLabel(off.category)} • {formatDate(off.date)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#DC2626' }}>
                      {formatCurrency(off.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* FAB FLUTUANTE NA ZONA DO POLEGAR */}
      <TouchableOpacity
        testID="new-expense-fab"
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

              <CalendarDatePicker
                testID="expense-create-date-picker"
                label="Data (Opcional)"
                placeholder="Hoje (Toque para escolher no calendário)"
                value={customDate}
                onChange={setCustomDate}
                outputFormat="BR"
              />

              {/* COMPRA PARCELADA */}
              {transactionType === TransactionType.EXPENSE && (
                <View
                  style={{
                    marginVertical: 12,
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isInstallment ? theme.primary : theme.border,
                    backgroundColor: isInstallment
                      ? (isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF')
                      : theme.surfaceSubtle,
                  }}
                >
                  <TouchableOpacity
                    testID="toggle-installment-btn"
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                    onPress={() => setIsInstallment(!isInstallment)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 20 }}>💳</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                          Compra Parcelada?
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                          Lança automaticamente nos meses seguintes
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isInstallment ? theme.primary : theme.textMuted,
                        backgroundColor: isInstallment ? theme.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isInstallment && <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  {isInstallment && (
                    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#DBEAFE' }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
                        Número de Parcelas
                      </Text>

                      {/* Quick chips: 2x, 3x, 4x, 5x, 6x, 10x, 12x */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {[2, 3, 4, 5, 6, 10, 12].map((num) => {
                          const isSel = totalInstallments === num;
                          return (
                            <TouchableOpacity
                              key={num}
                              testID={`installment-chip-${num}`}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isSel ? theme.primary : theme.border,
                                backgroundColor: isSel ? theme.primary : theme.inputBg,
                              }}
                              onPress={() => setTotalInstallments(num)}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: isSel ? '#FFF' : theme.textPrimary,
                                }}
                              >
                                {num}x
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Stepper for custom installments: [-] [ N ] [+] */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <TouchableOpacity
                          testID="installment-decrement"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: theme.inputBg,
                            borderWidth: 1,
                            borderColor: theme.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => setTotalInstallments(Math.max(2, totalInstallments - 1))}
                        >
                          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>-</Text>
                        </TouchableOpacity>

                        <Text testID="installment-count-label" style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary, minWidth: 50, textAlign: 'center' }}>
                          {totalInstallments}x
                        </Text>

                        <TouchableOpacity
                          testID="installment-increment"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: theme.inputBg,
                            borderWidth: 1,
                            borderColor: theme.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => setTotalInstallments(Math.min(72, totalInstallments + 1))}
                        >
                          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>+</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Simulation info */}
                      {(() => {
                        const numVal = unmaskCurrency(amount);
                        const parcelVal = !isNaN(numVal) && numVal > 0 ? (numVal / totalInstallments) : 0;
                        const startDate = customDate ? (parseDateInput(customDate) ? new Date(parseDateInput(customDate)!) : new Date()) : new Date();
                        const endDate = new Date(startDate);
                        endDate.setMonth(endDate.getMonth() + (totalInstallments - 1));
                        const startMonthName = MONTH_NAMES[startDate.getMonth()];
                        const endMonthName = MONTH_NAMES[endDate.getMonth()];
                        const startYear = startDate.getFullYear();
                        const endYear = endDate.getFullYear();

                        return (
                          <View
                            testID="installment-preview-box"
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0',
                            }}
                          >
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}>
                              📊 {totalInstallments} parcelas de {formatCurrency(parcelVal)}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                              🗓️ Cobranças de {startMonthName}/{startYear} até {endMonthName}/{endYear}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                              ✨ Cada parcela entrará no extrato e fechamento do seu respectivo mês.
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}
                </View>
              )}

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

              {scope === RecordScope.SHARED && partnerMembers.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <PartnerSelect
                    testID="expense-payer-select"
                    label="💳 Quem pagou esta conta compartilhada?"
                    members={partnerMembers}
                    selectedUserId={paidByUserId || user?.id || ''}
                    currentUserId={user?.id}
                    onSelect={setPaidByUserId}
                  />
                </View>
              )}

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

              <CalendarDatePicker
                testID="expense-edit-date-picker"
                label="Data"
                placeholder="Escolher data no calendário"
                value={customDate}
                onChange={setCustomDate}
                outputFormat="BR"
              />

              {/* COMPRA PARCELADA */}
              {transactionType === TransactionType.EXPENSE && (
                <View
                  style={{
                    marginVertical: 12,
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isInstallment ? theme.primary : theme.border,
                    backgroundColor: isInstallment
                      ? (isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF')
                      : theme.surfaceSubtle,
                  }}
                >
                  <TouchableOpacity
                    testID="edit-toggle-installment-btn"
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                    onPress={() => setIsInstallment(!isInstallment)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 20 }}>💳</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                          Compra Parcelada?
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                          Lança e projeta nos meses seguintes
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isInstallment ? theme.primary : theme.textMuted,
                        backgroundColor: isInstallment ? theme.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isInstallment && <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  {isInstallment && (
                    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#DBEAFE' }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
                        Número de Parcelas
                      </Text>

                      {/* Quick chips: 2x, 3x, 4x, 5x, 6x, 10x, 12x */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {[2, 3, 4, 5, 6, 10, 12].map((num) => {
                          const isSel = totalInstallments === num;
                          return (
                            <TouchableOpacity
                              key={num}
                              testID={`edit-installment-chip-${num}`}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isSel ? theme.primary : theme.border,
                                backgroundColor: isSel ? theme.primary : theme.inputBg,
                              }}
                              onPress={() => setTotalInstallments(num)}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: isSel ? '#FFF' : theme.textPrimary,
                                }}
                              >
                                {num}x
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Stepper for custom installments: [-] [ N ] [+] */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <TouchableOpacity
                          testID="edit-installment-decrement"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: theme.inputBg,
                            borderWidth: 1,
                            borderColor: theme.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => setTotalInstallments(Math.max(2, totalInstallments - 1))}
                        >
                          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>-</Text>
                        </TouchableOpacity>

                        <Text testID="edit-installment-count-label" style={{ fontSize: 16, fontWeight: '800', color: theme.textPrimary, minWidth: 50, textAlign: 'center' }}>
                          {totalInstallments}x
                        </Text>

                        <TouchableOpacity
                          testID="edit-installment-increment"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: theme.inputBg,
                            borderWidth: 1,
                            borderColor: theme.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => setTotalInstallments(Math.min(72, totalInstallments + 1))}
                        >
                          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>+</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Simulation info */}
                      {(() => {
                        const numVal = unmaskCurrency(amount);
                        const parcelVal = !isNaN(numVal) && numVal > 0 ? (numVal / totalInstallments) : 0;
                        const startDate = customDate ? (parseDateInput(customDate) ? new Date(parseDateInput(customDate)!) : new Date()) : new Date();
                        const endDate = new Date(startDate);
                        endDate.setMonth(endDate.getMonth() + (totalInstallments - 1));
                        const startMonthName = MONTH_NAMES[startDate.getMonth()];
                        const endMonthName = MONTH_NAMES[endDate.getMonth()];
                        const startYear = startDate.getFullYear();
                        const endYear = endDate.getFullYear();

                        return (
                          <View
                            testID="edit-installment-preview-box"
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0',
                            }}
                          >
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}>
                              📊 {totalInstallments} parcelas de {formatCurrency(parcelVal)}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                              🗓️ Cobranças de {startMonthName}/{startYear} até {endMonthName}/{endYear}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                              ✨ Cada parcela entrará no extrato e fechamento do seu respectivo mês.
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}
                </View>
              )}

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

              {scope === RecordScope.SHARED && partnerMembers.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <PartnerSelect
                    testID="expense-payer-select"
                    label="💳 Quem pagou esta conta compartilhada?"
                    members={partnerMembers}
                    selectedUserId={paidByUserId || user?.id || ''}
                    currentUserId={user?.id}
                    onSelect={setPaidByUserId}
                  />
                </View>
              )}

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
                    onPress={() => handleDelete(editingExpense.id, editingExpense.description, editingExpense)}
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
